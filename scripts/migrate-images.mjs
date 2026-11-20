// Chép ảnh đang nằm trên Base44 (media.base44.com...) sang R2 của bạn, để website không còn phụ thuộc Base44.
// Chạy trên máy của bạn (cần Internet và đã đăng nhập wrangler):   npm run images:migrate
//  - Quét dữ liệu trong import-data/ và ảnh giao diện trong src/lib/images.js
//  - Tải về, đẩy lên R2 (bucket gentravel-files, thư mục public/migrated/)
//  - Ghi import-data/images-map.json (db:import sẽ thay link cũ bằng link mới) và sửa src/lib/images.js
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, arg, flag, loadExport } from "./lib.mjs";

const bucket = arg("bucket", "gentravel-files");
const dir = join(ROOT, arg("dir", "import-data"));
const cache = join(ROOT, ".image-cache");
mkdirSync(cache, { recursive: true });

const URL_RE = /https?:\/\/(?:media\.base44\.com|[a-z0-9.-]*base44\.[a-z]+)\/[^\s"'<>)\\]+/gi;
const urls = new Set();
const scan = (text) => (text.match(URL_RE) || []).forEach((u) => urls.add(u.replace(/[.,;]+$/, "")));

if (existsSync(dir)) scan(JSON.stringify(loadExport(dir).data));
const imagesFile = join(ROOT, "src", "lib", "images.js");
const imagesSrc = readFileSync(imagesFile, "utf8");
const uiBase = (imagesSrc.match(/const BASE = "([^"]+)"/) || [])[1];
if (uiBase) for (const name of imagesSrc.match(/`\$\{BASE\}([^`]+)`/g) || []) urls.add(uiBase + name.slice(8, -1));

console.log(`Tìm thấy ${urls.size} ảnh trên Base44.`);
const mapFile = join(dir, "images-map.json");
mkdirSync(dir, { recursive: true });
const map = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, "utf8")) : {};
const where = flag("local") ? "--local" : "--remote";
let ok = 0;
let failed = 0;

for (const url of urls) {
  if (map[url]) continue;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = (response.headers.get("content-type") || "application/octet-stream").split(";")[0];
    const ext = extname(new URL(url).pathname).toLowerCase() || { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif" }[type] || ".bin";
    const bytes = Buffer.from(await response.arrayBuffer());
    const key = `public/migrated/${createHash("sha1").update(url).digest("hex").slice(0, 16)}${ext}`;
    const file = join(cache, key.split("/").pop());
    writeFileSync(file, bytes);
    const run = spawnSync("npx", ["wrangler", "r2", "object", "put", `${bucket}/${key}`, "--file", file, "--content-type", type, where], { cwd: ROOT, shell: true, encoding: "utf8" });
    if (run.status !== 0) throw new Error((run.stderr || run.stdout || "wrangler lỗi").trim().split("\n").slice(-3).join(" "));
    map[url] = `/files/${key}`;
    writeFileSync(mapFile, JSON.stringify(map, null, 2));
    ok += 1;
    console.log(`  ✓ ${url.slice(-50)} → /files/${key}`);
  } catch (error) {
    failed += 1;
    console.warn(`  ✗ ${url}: ${error.message}`);
  }
}

let patched = imagesSrc;
for (const [from, to] of Object.entries(map)) patched = patched.split(from).join(to);
if (uiBase && map[`${uiBase}${(imagesSrc.match(/`\$\{BASE\}([^`]+)`/) || [])[1]}`]) {
  // Ảnh giao diện đã nằm trên R2: bỏ BASE cũ.
  patched = patched.replace(/`\$\{BASE\}([^`]+)`/g, (m, name) => JSON.stringify(map[uiBase + name] || uiBase + name));
}
if (patched !== imagesSrc) writeFileSync(imagesFile, patched);
console.log(`\nXong: ${ok} ảnh mới, ${failed} lỗi. Bản đồ link: ${mapFile}`);
if (failed) console.log("Chạy lại lệnh để thử lại các ảnh lỗi (ảnh đã chép sẽ được bỏ qua).");
console.log("Tiếp theo: npm run db:import  rồi  git add -A && git commit && git push (để cập nhật ảnh giao diện).");
