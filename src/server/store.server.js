// Lớp dữ liệu thay thế Base44 `entities`: lưu mọi bảng trong một bảng D1 `records` (cột data = JSON),
// có phân quyền theo quy tắc `rls` của từng bảng trong schema/entities/*.jsonc.
import { env } from "cloudflare:workers";
import { SCHEMA } from "./db-schema";
import { assertField, matches, sortRecords, sortSql, toSql } from "./query";
import { ENTITIES, isEntity } from "./schema.server";

export const httpError = (status, message, data) => Object.assign(new Error(message), { status, data: data ?? null });

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 5000;
const MAX_SCAN = 20000;
const MAX_ROW_BYTES = 900_000;
const PROTECTED = ["id", "created_date", "updated_date", "created_by", "created_by_id"];
const BATCH = 50;

/* ------------------------------ Khởi tạo bảng ----------------------------- */

let schemaReady;

export function getDb() {
  if (!env.DB) throw httpError(500, "Chưa gắn cơ sở dữ liệu D1 (binding DB) cho Worker. Xem mục D1 trong HUONG-DAN-CLOUDFLARE.md.");
  return env.DB;
}

export async function ensureSchema() {
  const db = getDb();
  schemaReady ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((error) => {
    schemaReady = undefined;
    throw error;
  });
  await schemaReady;
  return db;
}

/* --------------------------------- Tiện ích -------------------------------- */

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const nowIso = () => new Date().toISOString();
export const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 24);

function hydrate(row) {
  let data = {};
  try {
    data = JSON.parse(row.data);
  } catch {
    data = {};
  }
  return {
    ...data,
    id: row.id,
    created_date: row.created_date,
    updated_date: row.updated_date,
    created_by: row.created_by ?? null,
    created_by_id: row.created_by_id ?? null,
  };
}

function cleanPayload(payload) {
  if (!isPlainObject(payload)) throw httpError(400, "Dữ liệu gửi lên phải là một đối tượng.");
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (PROTECTED.includes(key) || value === undefined) continue;
    assertField(key);
    out[key] = value;
  }
  return out;
}

const pickFields = (record, fields) => {
  if (!Array.isArray(fields) || fields.length === 0) return record;
  const out = { id: record.id };
  for (const field of fields) if (field in record) out[field] = record[field];
  return out;
};

function def(entity) {
  if (!isEntity(entity)) throw httpError(404, `Không có bảng dữ liệu "${String(entity).slice(0, 40)}".`);
  return ENTITIES[entity];
}

/* -------------------------------- Phân quyền ------------------------------- */
// ctx = { user: {id,email,role,...} | null, bypass: boolean }  (bypass = quyền service role)

const userMatches = (cond, user) =>
  !!user && Object.entries(cond || {}).every(([key, expected]) => (Array.isArray(expected) ? expected.includes(user[key]) : user[key] === expected));

function resolveTemplates(value, user) {
  if (typeof value === "string") {
    const m = value.match(/^\{\{\s*user\.([A-Za-z0-9_]+)\s*\}\}$/);
    if (!m) return value;
    const v = user?.[m[1]];
    return v === undefined || v === null ? undefined : v;
  }
  return value;
}

/** Trả về null (từ chối) hoặc một truy vấn bổ sung ({} = cho phép tất cả). */
function evalRule(spec, user) {
  if (!isPlainObject(spec)) return {};
  const extra = {};
  const ands = [];
  for (const [key, val] of Object.entries(spec)) {
    if (key === "user_condition") {
      if (!userMatches(val, user)) return null;
    } else if (key === "$or") {
      const branches = (val || []).map((branch) => evalRule(branch, user)).filter((b) => b !== null);
      if (branches.length === 0) return null;
      if (branches.some((b) => Object.keys(b).length === 0)) continue; // có nhánh cho phép tất cả
      ands.push({ $or: branches });
    } else if (key === "$and") {
      const parts = (val || []).map((branch) => evalRule(branch, user));
      if (parts.some((p) => p === null)) return null;
      parts.filter((p) => Object.keys(p).length > 0).forEach((p) => ands.push(p));
    } else {
      const resolved = resolveTemplates(val, user);
      if (resolved === undefined) return null;
      extra[key] = resolved;
    }
  }
  if (ands.length) {
    return Object.keys(extra).length ? { $and: [extra, ...ands] } : ands.length === 1 ? ands[0] : { $and: ands };
  }
  return extra;
}

const SELF_EDITABLE = new Set(["full_name"]);

/** Quy tắc cho từng hành động. Trả về null (từ chối) hoặc truy vấn bổ sung. */
function ruleFor(entity, action, ctx, patch) {
  if (ctx.bypass) return {};
  const { user } = ctx;
  if (entity === "User") {
    if (!user) return null;
    const admin = user.role === "admin";
    if (action === "read") return admin ? {} : { id: user.id };
    if (action === "update") {
      if (admin) return {};
      const keys = Object.keys(patch || {});
      return keys.every((k) => SELF_EDITABLE.has(k)) ? { id: user.id } : null;
    }
    if (action === "delete") return admin ? {} : null;
    return null; // tạo tài khoản chỉ qua /api/auth
  }
  const rls = def(entity).rls;
  const spec = rls && Object.prototype.hasOwnProperty.call(rls, action) ? rls[action] : { user_condition: { role: "admin" } };
  return evalRule(spec, user);
}

const withRule = (query, rule) => (rule && Object.keys(rule).length ? { $and: [query || {}, rule] } : query || {});

/* --------------------------------- Đọc dữ liệu ----------------------------- */

function parseListArgs(args, filtering) {
  const out = { query: {}, sort: undefined, limit: undefined, skip: 0, fields: undefined };
  let rest = args;
  if (filtering) {
    out.query = args[0] ?? {};
    if (!isPlainObject(out.query)) throw httpError(400, "Truy vấn phải là một đối tượng.");
    rest = args.slice(1);
  }
  if (isPlainObject(rest[0])) {
    const o = rest[0];
    out.sort = o.sort;
    out.limit = o.limit;
    out.skip = o.skip ?? 0;
    out.fields = o.fields;
  } else {
    [out.sort, out.limit, out.skip = 0, out.fields] = rest;
  }
  out.limit = Math.min(Math.max(Number.isFinite(Number(out.limit)) && out.limit != null ? Math.floor(Number(out.limit)) : DEFAULT_LIMIT, 0), MAX_LIMIT);
  out.skip = Math.max(Number.isFinite(Number(out.skip)) ? Math.floor(Number(out.skip)) : 0, 0);
  return out;
}

async function fetchRows(db, entity, query, { sort, limit, skip }) {
  const { sql, params, exact } = toSql(query, ENTITIES[entity].arrayFields);
  if (exact) {
    const { results } = await db
      .prepare(`SELECT * FROM records WHERE entity = ? AND (${sql}) ${sortSql(sort)} LIMIT ? OFFSET ?`)
      .bind(entity, ...params, limit, skip)
      .all();
    return results.map(hydrate);
  }
  const { results } = await db
    .prepare(`SELECT * FROM records WHERE entity = ? AND (${sql}) LIMIT ${MAX_SCAN}`)
    .bind(entity, ...params)
    .all();
  const rows = results.map(hydrate).filter((record) => matches(record, query));
  return sortRecords(rows, sort).slice(skip, skip + limit);
}

async function countRows(db, entity, query) {
  const { sql, params, exact } = toSql(query, ENTITIES[entity].arrayFields);
  if (exact) {
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM records WHERE entity = ? AND (${sql})`).bind(entity, ...params).first();
    return row?.n ?? 0;
  }
  const { results } = await db.prepare(`SELECT * FROM records WHERE entity = ? AND (${sql}) LIMIT ${MAX_SCAN}`).bind(entity, ...params).all();
  return results.map(hydrate).filter((record) => matches(record, query)).length;
}

async function getRecord(db, entity, id) {
  if (typeof id !== "string" || !id || id.length > 80) throw httpError(404, "Không tìm thấy bản ghi.");
  const row = await db.prepare("SELECT * FROM records WHERE entity = ? AND id = ?").bind(entity, id).first();
  return row ? hydrate(row) : null;
}

/* ------------------------------- Ghi dữ liệu ------------------------------- */

function toRow(entity, record) {
  const { id, created_date, updated_date, created_by, created_by_id, ...data } = record;
  const json = JSON.stringify(data);
  if (json.length > MAX_ROW_BYTES) throw httpError(413, "Bản ghi quá lớn (tối đa ~900KB). Hãy giảm nội dung hoặc ảnh nhúng trực tiếp.");
  return [entity, id, json, created_date, updated_date, created_by ?? null, created_by_id ?? null];
}

const INSERT_SQL = "INSERT INTO records (entity, id, data, created_date, updated_date, created_by, created_by_id) VALUES (?, ?, ?, ?, ?, ?, ?)";
const UPDATE_SQL = "UPDATE records SET data = ?, updated_date = ? WHERE entity = ? AND id = ?";

function buildNew(entity, payload, ctx) {
  const now = nowIso();
  const clean = cleanPayload(payload);
  const merged = { ...def(entity).defaults, ...clean };
  const missing = def(entity).required.filter((key) => merged[key] === undefined || merged[key] === null || merged[key] === "");
  if (missing.length) throw httpError(422, `Thiếu trường bắt buộc: ${missing.join(", ")}`);
  return {
    ...def(entity).defaults,
    ...clean,
    id: newId(),
    created_date: now,
    updated_date: now,
    created_by: ctx.user?.email ?? null,
    created_by_id: ctx.user?.id ?? null,
  };
}

function checkWrite(entity, action, ctx, record, patch) {
  const rule = ruleFor(entity, action, ctx, patch);
  if (rule === null || (record && Object.keys(rule).length && !matches(record, rule))) {
    throw httpError(403, "Bạn không có quyền thực hiện thao tác này.");
  }
}

async function runBatch(db, statements) {
  for (let i = 0; i < statements.length; i += BATCH) await db.batch(statements.slice(i, i + BATCH));
}

/* ------------------------------ Điểm vào chính ----------------------------- */

export async function runEntityOp(ctx, entity, method, args = []) {
  if (!Array.isArray(args)) throw httpError(400, "args phải là một mảng.");
  def(entity);
  const db = await ensureSchema();

  switch (method) {
    case "list":
    case "filter": {
      const opts = parseListArgs(args, method === "filter");
      const rule = ruleFor(entity, "read", ctx);
      if (rule === null) return [];
      const rows = await fetchRows(db, entity, withRule(opts.query, rule), opts);
      return rows.map((r) => pickFields(r, opts.fields));
    }
    case "count": {
      const query = args[0] ?? {};
      if (!isPlainObject(query)) throw httpError(400, "Truy vấn phải là một đối tượng.");
      const rule = ruleFor(entity, "read", ctx);
      if (rule === null) return 0;
      return countRows(db, entity, withRule(query, rule));
    }
    case "get": {
      const record = await getRecord(db, entity, args[0]);
      const rule = ruleFor(entity, "read", ctx);
      if (!record || rule === null || (Object.keys(rule).length && !matches(record, rule))) throw httpError(404, "Không tìm thấy bản ghi.");
      return record;
    }
    case "create": {
      checkWrite(entity, "create", ctx);
      const record = buildNew(entity, args[0], ctx);
      await db.prepare(INSERT_SQL).bind(...toRow(entity, record)).run();
      return record;
    }
    case "bulkCreate": {
      if (!Array.isArray(args[0]) || args[0].length > 500) throw httpError(400, "bulkCreate cần một mảng tối đa 500 phần tử.");
      checkWrite(entity, "create", ctx);
      const records = args[0].map((item) => buildNew(entity, item, ctx));
      await runBatch(db, records.map((r) => db.prepare(INSERT_SQL).bind(...toRow(entity, r))));
      return records;
    }
    case "update": {
      const [id, patch] = args;
      const existing = await getRecord(db, entity, id);
      if (!existing) throw httpError(404, "Không tìm thấy bản ghi.");
      const clean = cleanPayload(patch);
      checkWrite(entity, "update", ctx, existing, clean);
      const next = { ...existing, ...clean, updated_date: nowIso() };
      const row = toRow(entity, next);
      await db.prepare(UPDATE_SQL).bind(row[2], row[4], entity, id).run();
      return next;
    }
    case "bulkUpdate": {
      const items = args[0];
      if (!Array.isArray(items) || items.length > 500) throw httpError(400, "bulkUpdate cần một mảng tối đa 500 phần tử.");
      const ids = [...new Set(items.map((i) => i?.id).filter((v) => typeof v === "string"))];
      const existing = new Map();
      for (let i = 0; i < ids.length; i += 80) {
        const part = ids.slice(i, i + 80);
        const { results } = await db
          .prepare(`SELECT * FROM records WHERE entity = ? AND id IN (${part.map(() => "?").join(",")})`)
          .bind(entity, ...part)
          .all();
        results.forEach((row) => existing.set(row.id, hydrate(row)));
      }
      const out = [];
      const statements = [];
      for (const item of items) {
        const current = existing.get(item?.id);
        if (!current) continue;
        const { id, ...rest } = item;
        const clean = cleanPayload(rest);
        checkWrite(entity, "update", ctx, current, clean);
        const next = { ...current, ...clean, updated_date: nowIso() };
        const row = toRow(entity, next);
        statements.push(db.prepare(UPDATE_SQL).bind(row[2], row[4], entity, id));
        existing.set(id, next);
        out.push(next);
      }
      await runBatch(db, statements);
      return out;
    }
    case "delete": {
      const existing = await getRecord(db, entity, args[0]);
      if (!existing) throw httpError(404, "Không tìm thấy bản ghi.");
      checkWrite(entity, "delete", ctx, existing);
      await db.prepare("DELETE FROM records WHERE entity = ? AND id = ?").bind(entity, args[0]).run();
      return { success: true };
    }
    case "aggregate": {
      const spec = isPlainObject(args[0]) ? args[0] : {};
      const rule = ruleFor(entity, "read", ctx);
      if (rule === null) return { rows: [] };
      const query = isPlainObject(spec.query) ? spec.query : {};
      const rows = await fetchRows(db, entity, withRule(query, rule), { sort: "created_date", limit: MAX_SCAN, skip: 0 });
      const groupBy = spec.groupBy ? [].concat(spec.groupBy).map(assertField) : [];
      const groups = new Map();
      for (const record of rows) {
        const key = JSON.stringify(groupBy.map((f) => record[f] ?? null));
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(record);
      }
      const out = [];
      for (const [key, items] of groups) {
        const values = JSON.parse(key);
        const row = {};
        groupBy.forEach((f, i) => { row[f] = values[i]; });
        row.count = items.length;
        for (const op of ["sum", "avg", "min", "max"]) {
          for (const field of [].concat(spec[op] || []).map(assertField)) {
            const nums = items.map((r) => Number(r[field])).filter(Number.isFinite);
            row[`${op}_${field}`] = !nums.length ? null : op === "sum" ? nums.reduce((a, b) => a + b, 0) : op === "avg" ? nums.reduce((a, b) => a + b, 0) / nums.length : op === "min" ? Math.min(...nums) : Math.max(...nums);
          }
        }
        out.push(row);
      }
      return { rows: out };
    }
    default:
      throw httpError(400, `Phương thức không hỗ trợ: ${String(method).slice(0, 30)}`);
  }
}

