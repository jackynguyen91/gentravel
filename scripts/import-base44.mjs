// Nhập dữ liệu xuất từ Base44 vào D1.
//
//  1) Từ Base44: mở app → Dashboard → Data → chọn từng bảng → Export (JSON hoặc CSV).
//     Lưu mỗi bảng thành import-data/<TênBảng>.json (hoặc .csv), ví dụ import-data/Tour.json.
//  2) (Tuỳ chọn) chạy  npm run images:migrate  để chép ảnh sang R2 trước.
//  3) Chạy:  npm run db:import           → tạo file import.sql
//     rồi:   npx wrangler d1 execute gentravel-db --remote --file import.sql
//     (thêm --local thay cho --remote nếu muốn thử trên máy)
//
// Giữ nguyên id, ngày tạo, người tạo. Tài khoản (User) được nhập KHÔNG kèm mật khẩu: mỗi người dùng
// "Quên mật khẩu" một lần, hoặc admin chạy:  npm run user:password -- email@... MatKhauMoi
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA } from "../src/server/db-schema.js";
import { ROOT, arg, loadExport } from "./lib.mjs";

const dir = join(ROOT, arg("dir", "import-data"));
const { data } = loadExport(dir);
const mapFile = join(dir, "images-map.json");
const imageMap = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, "utf8")) : {};

const q = (value) => (value === null || value === undefined ? "NULL" : `'${String(value).replace(/'/g, "''")}'`);
const BUILTIN = ["id", "created_date", "updated_date", "created_by", "created_by_id"];
const newId = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
const iso = (v, fallback) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : fallback;
};

const lines = [...SCHEMA.map((s) => `${s.replace(/\s+/g, " ").trim()};`)];
const counts = {};
const warnings = [];
const now = new Date().toISOString();

for (const [entity, rows] of Object.entries(data)) {
  counts[entity] = 0;
  const seen = new Set();
  for (const row of rows) {
    const id = String(row.id || newId());
    if (seen.has(id)) continue;
    seen.add(id);
    const body = Object.fromEntries(Object.entries(row).filter(([k]) => !BUILTIN.includes(k)));
    let json = JSON.stringify(body);
    for (const [from, to] of Object.entries(imageMap)) json = json.split(JSON.stringify(from).slice(1, -1)).join(JSON.stringify(to).slice(1, -1));
    const created = iso(row.created_date, now);
    if (json.length > 90_000) warnings.push(`${entity} ${id}: dữ liệu ${Math.round(json.length / 1024)} KB, lớn hơn giới hạn 100 KB của D1 cho một dòng. Thường do ảnh nhúng dạng base64.`);
    lines.push(
      `INSERT OR REPLACE INTO records (entity, id, data, created_date, updated_date, created_by, created_by_id) VALUES (${q(entity)}, ${q(id)}, ${q(json)}, ${q(created)}, ${q(iso(row.updated_date, created))}, ${q(row.created_by)}, ${q(row.created_by_id)});`,
    );
    counts[entity] += 1;
  }
}

writeFileSync(join(ROOT, "import.sql"), `${lines.join("\n")}\n`);
console.log("Đã tạo import.sql với số bản ghi:");
for (const [entity, n] of Object.entries(counts)) console.log(`  ${entity.padEnd(16)} ${n}`);
if (!Object.keys(counts).length) console.log("  (không tìm thấy file nào trong import-data/)");
for (const w of warnings) console.warn("CẢNH BÁO:", w);
console.log("\nBước tiếp theo:\n  npx wrangler d1 execute gentravel-db --remote --file import.sql");
