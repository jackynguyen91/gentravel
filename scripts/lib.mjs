// Đọc dữ liệu xuất từ Base44 (thư mục import-data/<TênBảng>.json hoặc .csv) và chuẩn hoá theo schema/entities.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const stripJsonc = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(text.replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (_m, str) => str ?? ""));
  }
};

export function loadSchemas() {
  const dir = join(ROOT, "schema", "entities");
  const out = {};
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonc"))) {
    const def = stripJsonc(readFileSync(join(dir, file), "utf8"));
    out[def.name || file.replace(/\.jsonc$/, "")] = def.properties || {};
  }
  return out;
}

/** CSV theo RFC 4180: có hỗ trợ ngoặc kép, dấu phẩy và xuống dòng trong ô. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);
  const [head = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}

function coerce(value, spec) {
  if (typeof value !== "string") return value;
  const type = spec?.type;
  const text = value.trim();
  if (type === "number" || type === "integer") return text === "" ? undefined : Number.isFinite(Number(text)) ? Number(text) : value;
  if (type === "boolean") return text === "" ? undefined : /^(true|1|yes|có)$/i.test(text);
  if (type === "array" || type === "object") {
    if (text === "") return undefined;
    try { return JSON.parse(text); } catch { return type === "array" ? text.split(/\s*[;|]\s*/) : value; }
  }
  if (text === "") return undefined;
  return value;
}

const DROP = new Set(["_id", "app_id", "entity_name", "is_sample", "__v"]);

export function normalize(record, props) {
  const out = {};
  for (const [key, raw] of Object.entries(record)) {
    if (DROP.has(key)) continue;
    const value = coerce(raw, props[key]);
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

export function loadExport(dir) {
  const schemas = loadSchemas();
  const data = {};
  if (!existsSync(dir)) throw new Error(`Không thấy thư mục dữ liệu: ${dir}`);
  for (const name of Object.keys(schemas)) {
    const json = join(dir, `${name}.json`);
    const csv = join(dir, `${name}.csv`);
    let rows = null;
    if (existsSync(json)) {
      const parsed = JSON.parse(readFileSync(json, "utf8").replace(/^\uFEFF/, ""));
      rows = Array.isArray(parsed) ? parsed : parsed.items || parsed.data || parsed.results || [];
    } else if (existsSync(csv)) rows = parseCsv(readFileSync(csv, "utf8"));
    if (rows) data[name] = rows.map((r) => normalize(r, schemas[name]));
  }
  return { data, schemas };
}

export const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
export const flag = (name) => process.argv.includes(`--${name}`);
