// Chạy thử website trên máy với D1/R2 giả lập cục bộ:   npm run cf:dev   → mở http://localhost:8787
//  - đọc bí mật từ file .dev.vars (xem .dev.vars.example)
//  - Workers AI không chạy được cục bộ nên tắt khi thử (gợi ý SEO AI chỉ dùng được sau khi deploy)
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { ROOT } from "./lib.mjs";

const out = join(ROOT, "dist", "server");
if (!existsSync(join(out, "wrangler.json"))) {
  console.error("Chưa có bản build. Chạy:  npm run build");
  process.exit(1);
}
if (existsSync(join(ROOT, ".dev.vars"))) copyFileSync(join(ROOT, ".dev.vars"), join(out, ".dev.vars"));
else console.warn("Chưa có file .dev.vars: hãy sao chép .dev.vars.example thành .dev.vars và điền JWT_SECRET.");
const config = JSON.parse(readFileSync(join(out, "wrangler.json"), "utf8"));
delete config.ai;
writeFileSync(join(out, "wrangler.local.json"), JSON.stringify(config));
spawn("npx", ["wrangler", "dev", "--config", "dist/server/wrangler.local.json", "--persist-to", ".wrangler/state", ...process.argv.slice(2)], { cwd: ROOT, stdio: "inherit", shell: true });
