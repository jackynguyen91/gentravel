// Danh sách bảng dữ liệu (entity), giá trị mặc định và quy tắc phân quyền (RLS).
// Nguồn: schema/entities/*.jsonc — chính là định nghĩa bảng xuất ra từ Base44, giữ nguyên để không phải viết lại.
const files = import.meta.glob("/schema/entities/*.jsonc", { query: "?raw", import: "default", eager: true });

function parseJsonc(text) {
  try {
    return JSON.parse(text);
  } catch {
    // Bỏ chú thích // và /* */ (không nằm trong chuỗi) rồi thử lại.
    const stripped = text.replace(/("(?:\\.|[^"\\])*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (_m, str) => str ?? "");
    return JSON.parse(stripped);
  }
}

export const ENTITIES = {};
for (const [path, text] of Object.entries(files)) {
  const def = parseJsonc(text);
  const name = def.name || path.split("/").pop().replace(/\.jsonc$/, "");
  const props = def.properties || {};
  const defaults = {};
  const arrayFields = new Set();
  for (const [key, spec] of Object.entries(props)) {
    if (spec && Object.prototype.hasOwnProperty.call(spec, "default")) defaults[key] = spec.default;
    if (spec?.type === "array") arrayFields.add(key);
  }
  ENTITIES[name] = { name, rls: def.rls || null, defaults, arrayFields, required: Array.isArray(def.required) ? def.required : [] };
}

export const isEntity = (name) => typeof name === "string" && Object.prototype.hasOwnProperty.call(ENTITIES, name);
