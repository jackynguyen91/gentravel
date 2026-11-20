// Bộ xử lý truy vấn kiểu Mongo (giống Base44) trên bảng D1 `records`.
//  - toSql(): dịch phần đơn giản (so sánh bằng, $in, $gt...) thành SQL để D1 lọc sẵn.
//  - matches(): bộ lọc JavaScript đầy đủ ($or, $and, $regex, mảng...) dùng khi SQL không diễn tả được.
// Tên trường luôn được kiểm tra bằng regex trước khi đưa vào SQL, giá trị luôn đi qua tham số (?).

export const BUILTIN = new Set(["id", "created_date", "updated_date", "created_by", "created_by_id"]);
const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/;

export function assertField(field) {
  if (typeof field !== "string" || field.length > 80 || !FIELD_RE.test(field)) {
    throw Object.assign(new Error(`Tên trường không hợp lệ: ${String(field).slice(0, 40)}`), { status: 400 });
  }
  return field;
}

const column = (field) => {
  assertField(field);
  return BUILTIN.has(field) ? field : `json_extract(data, '$.${field}')`;
};

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const bind = (v) => (typeof v === "boolean" ? (v ? 1 : 0) : v);
const SCALAR = (v) => v === null || ["string", "number", "boolean"].includes(typeof v);
const OPS = new Set(["$in", "$nin", "$ne", "$eq", "$gt", "$gte", "$lt", "$lte", "$exists", "$regex", "$options", "$not"]);

/** @returns {{ sql: string, params: any[], exact: boolean }} */
export function toSql(query, arrayFields = new Set()) {
  const params = [];
  let exact = true;

  const node = (q) => {
    if (!isPlainObject(q)) throw Object.assign(new Error("Truy vấn không hợp lệ"), { status: 400 });
    const parts = [];
    for (const [key, value] of Object.entries(q)) {
      if (key === "$and" || key === "$or") {
        if (!Array.isArray(value)) throw Object.assign(new Error(`${key} phải là mảng`), { status: 400 });
        if (value.length === 0) {
          if (key === "$or") parts.push("0");
          continue;
        }
        // Nhánh chỉ lọc được bằng JS cho ra "1" (tập rộng hơn), nên AND/OR vẫn đúng là tập bao ngoài;
        // khi đó exact=false và JS lọc lại lần nữa.
        const sub = value.map((item) => node(item));
        parts.push(`(${sub.join(key === "$and" ? " AND " : " OR ")})`);
        continue;
      }
      if (key.startsWith("$")) {
        exact = false;
        continue;
      }
      parts.push(field(key, value));
    }
    return parts.length ? parts.join(" AND ") : "1";
  };

  const field = (key, value) => {
    const col = column(key);
    if (arrayFields.has(key) || key.includes(".")) {
      exact = false;
      return "1";
    }
    if (SCALAR(value)) {
      if (value === null) return `${col} IS NULL`;
      params.push(bind(value));
      return `${col} = ?`;
    }
    if (isPlainObject(value)) {
      const out = [];
      for (const [op, arg] of Object.entries(value)) {
        if (!OPS.has(op)) throw Object.assign(new Error(`Toán tử không hỗ trợ: ${op}`), { status: 400 });
        if (op === "$options") continue;
        if (op === "$eq" && SCALAR(arg) && arg !== null) {
          params.push(bind(arg));
          out.push(`${col} = ?`);
        } else if (op === "$ne" && SCALAR(arg)) {
          params.push(bind(arg));
          out.push(`${col} IS NOT ?`);
        } else if ((op === "$in" || op === "$nin") && Array.isArray(arg) && arg.every((v) => SCALAR(v) && v !== null) && arg.length > 0 && arg.length <= 200) {
          arg.forEach((v) => params.push(bind(v)));
          out.push(`${col} ${op === "$in" ? "IN" : "NOT IN"} (${arg.map(() => "?").join(",")})`);
        } else if (["$gt", "$gte", "$lt", "$lte"].includes(op) && SCALAR(arg) && arg !== null) {
          params.push(bind(arg));
          out.push(`${col} ${{ $gt: ">", $gte: ">=", $lt: "<", $lte: "<=" }[op]} ?`);
        } else if (op === "$exists" && typeof arg === "boolean") {
          out.push(arg ? `${col} IS NOT NULL` : `${col} IS NULL`);
        } else {
          exact = false; // $regex, $not, $in rỗng...: để bộ lọc JS xử lý
        }
      }
      return out.length ? out.join(" AND ") : "1";
    }
    exact = false;
    return "1";
  };

  const sql = node(query || {});
  return { sql, params, exact };
}

/* ------------------------------- JS matcher ------------------------------- */

const getPath = (record, path) => path.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), record);

const looseEqual = (a, b) => {
  if (Array.isArray(a)) return a.some((item) => looseEqual(item, b)) || (Array.isArray(b) && JSON.stringify(a) === JSON.stringify(b));
  if (a === undefined || a === null) return b === null || b === undefined;
  return a === b;
};

export function matches(record, query) {
  for (const [key, cond] of Object.entries(query || {})) {
    if (key === "$and") {
      if (!cond.every((q) => matches(record, q))) return false;
      continue;
    }
    if (key === "$or") {
      if (!cond.some((q) => matches(record, q))) return false;
      continue;
    }
    if (key === "$nor") {
      if (cond.some((q) => matches(record, q))) return false;
      continue;
    }
    if (key.startsWith("$")) return false;
    const value = getPath(record, key);
    if (isPlainObject(cond)) {
      for (const [op, arg] of Object.entries(cond)) {
        const ok = (() => {
          switch (op) {
            case "$eq": return looseEqual(value, arg);
            case "$ne": return !looseEqual(value, arg);
            case "$in": return arg.some((v) => looseEqual(value, v));
            case "$nin": return !arg.some((v) => looseEqual(value, v));
            case "$gt": return value != null && value > arg;
            case "$gte": return value != null && value >= arg;
            case "$lt": return value != null && value < arg;
            case "$lte": return value != null && value <= arg;
            case "$exists": return arg ? value !== undefined && value !== null : value === undefined || value === null;
            case "$regex": {
              if (value == null) return false;
              const flags = typeof cond.$options === "string" ? cond.$options.replace(/[^imsu]/g, "") : "i";
              let re;
              try {
                re = new RegExp(arg instanceof RegExp ? arg.source : String(arg), flags);
              } catch {
                throw Object.assign(new Error("Biểu thức tìm kiếm không hợp lệ"), { status: 400 });
              }
              return Array.isArray(value) ? value.some((v) => re.test(String(v))) : re.test(String(value));
            }
            case "$options": return true;
            case "$not": return !matches(record, { [key]: arg });
            default: throw Object.assign(new Error(`Toán tử không hỗ trợ: ${op}`), { status: 400 });
          }
        })();
        if (!ok) return false;
      }
    } else if (!looseEqual(value, cond)) {
      return false;
    }
  }
  return true;
}

/* --------------------------------- Sắp xếp -------------------------------- */

export function parseSort(sort) {
  const raw = Array.isArray(sort) ? sort : typeof sort === "string" && sort ? sort.split(",") : ["-created_date"];
  return raw.slice(0, 3).map((item) => {
    const text = String(item).trim();
    const desc = text.startsWith("-");
    return { field: assertField(text.replace(/^[-+]/, "")), desc };
  });
}

export function sortSql(sort) {
  const keys = parseSort(sort).map(({ field, desc }) => `${column(field)} ${desc ? "DESC" : "ASC"}`);
  return `ORDER BY ${keys.join(", ")}, id ASC`;
}

export function sortRecords(rows, sort) {
  const keys = parseSort(sort);
  return rows.sort((a, b) => {
    for (const { field, desc } of keys) {
      const x = getPath(a, field);
      const y = getPath(b, field);
      if (x === y) continue;
      if (x == null) return desc ? 1 : -1;
      if (y == null) return desc ? -1 : 1;
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0;
      if (cmp !== 0) return desc ? -cmp : cmp;
    }
    return 0;
  });
}
