// Lưu file trên Cloudflare R2 (binding FILES).
//  - Công khai:  /files/public/<tên>      → ai cũng xem được (ảnh tour, ảnh bài viết...)
//  - Riêng tư:   file_uri "private:<key>" → chỉ mở được bằng liên kết ký (HMAC) có hạn dùng, do admin tạo.
import { env } from "cloudflare:workers";
import { hmacHex } from "./auth.server";
import { httpError } from "./store.server";

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
  "application/pdf": "pdf", "video/mp4": "mp4",
};
const safeName = (name) =>
  String(name || "file").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";

function bucket() {
  if (!env.FILES) throw httpError(500, "Chưa gắn R2 bucket (binding FILES) cho Worker. Xem mục R2 trong HUONG-DAN-CLOUDFLARE.md.");
  return env.FILES;
}

export async function uploadFile(file, { isPrivate, uploader }) {
  if (!file || typeof file.arrayBuffer !== "function") throw httpError(400, "Không nhận được file.");
  if (file.size > MAX_UPLOAD_BYTES) throw httpError(413, "File quá lớn (tối đa 12 MB).");
  const type = String(file.type || "").toLowerCase();
  const ext = ALLOWED[type];
  if (!ext) throw httpError(415, "Chỉ hỗ trợ ảnh (JPG, PNG, WebP, GIF, AVIF), PDF hoặc MP4.");
  const base = safeName(file.name).replace(/\.[A-Za-z0-9]+$/, "");
  const key = `${isPrivate ? "private" : "public"}/${crypto.randomUUID().slice(0, 12)}-${base}.${ext}`;
  await bucket().put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type }, customMetadata: { uploader: String(uploader || "") } });
  return isPrivate ? { file_uri: `private:${key}` } : { file_url: `/files/${key}` };
}

export async function signedUrl(fileUri, origin, minutes = 30) {
  const key = String(fileUri || "").replace(/^private:/, "");
  if (!key.startsWith("private/") || key.includes("..")) throw httpError(400, "file_uri không hợp lệ.");
  const exp = Date.now() + minutes * 60 * 1000;
  const sig = await hmacHex(`${key}|${exp}`);
  return { signed_url: `${origin}/files/signed?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}` };
}

function respond(object, { cache }) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "sandbox");
  headers.set("cache-control", cache);
  return new Response(object.body, { headers });
}

/** GET /files/public/* và GET /files/signed */
export async function serveFile(url) {
  const r2 = bucket();
  if (url.pathname === "/files/signed") {
    const key = url.searchParams.get("key") || "";
    const exp = Number(url.searchParams.get("exp"));
    const sig = url.searchParams.get("sig") || "";
    if (!key.startsWith("private/") || !(exp > Date.now()) || sig !== (await hmacHex(`${key}|${exp}`))) return new Response("Liên kết hết hạn hoặc không hợp lệ", { status: 403 });
    const object = await r2.get(key);
    return object ? respond(object, { cache: "private, no-store" }) : new Response("Không tìm thấy", { status: 404 });
  }
  const key = decodeURIComponent(url.pathname.slice("/files/".length));
  if (!key.startsWith("public/") || key.includes("..")) return new Response("Không tìm thấy", { status: 404 });
  const object = await r2.get(key);
  return object ? respond(object, { cache: "public, max-age=31536000, immutable" }) : new Response("Không tìm thấy", { status: 404 });
}
