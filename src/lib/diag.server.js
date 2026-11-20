// Trang chẩn đoán (mở /api/diag): cho biết Worker đã gắn D1, R2, secret... chưa. Không trả bí mật, chỉ true/false.
import { env } from "cloudflare:workers";
import { ENTITIES } from "@/server/schema.server";
import { ensureSchema } from "@/server/store.server";

export async function runDiagnostics() {
  const out = {
    jwtSecretOk: Boolean(env.JWT_SECRET && env.JWT_SECRET.length >= 32),
    d1Bound: Boolean(env.DB),
    r2Bound: Boolean(env.FILES),
    aiBound: Boolean(env.AI),
    emailConfigured: Boolean(env.RESEND_API_KEY && env.MAIL_FROM),
    adminEmails: env.ADMIN_EMAILS ? "đã khai báo" : "chưa khai báo (tài khoản đăng ký đầu tiên sẽ là admin)",
    entities: Object.keys(ENTITIES).length,
  };
  try {
    const db = await ensureSchema();
    const row = await db.prepare("SELECT COUNT(*) AS n FROM records").first();
    const users = await db.prepare("SELECT COUNT(*) AS n FROM records WHERE entity = 'User'").first();
    out.d1 = { ok: true, records: row?.n ?? 0, users: users?.n ?? 0 };
  } catch (error) {
    out.d1 = { ok: false, error: String(error?.message ?? error) };
  }
  return out;
}
