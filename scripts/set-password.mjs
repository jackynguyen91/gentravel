// Đặt/đổi mật khẩu cho một tài khoản (dùng khi quên mật khẩu admin hoặc sau khi nhập dữ liệu từ Base44).
//   npm run user:password -- admin@congty.vn MatKhauMoi123
// Tạo file set-password.sql, rồi chạy bằng wrangler (thêm --local nếu thử trên máy):
//   npx wrangler d1 execute gentravel-db --remote --file set-password.sql
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const [email, password] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!email || !password || password.length < 8) {
  console.error("Cách dùng: npm run user:password -- email@congty.vn MatKhauMoi (tối thiểu 8 ký tự)");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 100000, 32, "sha256");
const stored = `pbkdf2$100000$${salt.toString("base64")}$${hash.toString("base64")}`;
const e = email.trim().toLowerCase().replace(/'/g, "''");
const sql = `INSERT INTO credentials (user_id, password_hash) SELECT id, '${stored}' FROM records WHERE entity = 'User' AND json_extract(data, '$.email') = '${e}' ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash, reset_hash = NULL, reset_expires = NULL;\n`;
writeFileSync("set-password.sql", sql);
console.log("Đã tạo set-password.sql. Chạy tiếp lệnh sau để áp dụng lên Cloudflare:");
console.log("  npx wrangler d1 execute gentravel-db --remote --file set-password.sql");
console.log("Sau khi xong nên xoá file set-password.sql (chứa mã băm mật khẩu).");
