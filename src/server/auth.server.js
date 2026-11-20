// Đăng nhập tự quản (thay Base44 auth): email + mật khẩu, phiên bằng JWT (HS256) ký bằng secret JWT_SECRET.
// Mật khẩu băm PBKDF2-SHA256 (WebCrypto) và lưu ở bảng riêng `credentials`, không nằm trong dữ liệu User.
import { env } from "cloudflare:workers";
import { sendEmail } from "./email.server";
import { ensureSchema, httpError, newId, runEntityOp } from "./store.server";

const SERVICE = { bypass: true, user: null };
const enc = new TextEncoder();
const TOKEN_DAYS = 30;
// Workers giới hạn PBKDF2 tối đa 100.000 vòng. Gói Free chỉ có 10ms CPU/lần gọi nên có thể cần giảm
// (biến PBKDF2_ITERATIONS, tối thiểu 10.000). Mật khẩu đã lưu luôn được kiểm tra bằng đúng số vòng lúc tạo.
const iterations = () => Math.min(100_000, Math.max(10_000, Number(env.PBKDF2_ITERATIONS) || 100_000));
const LOCKED_STATUS = "Đã khóa";

/* --------------------------------- base64url -------------------------------- */

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const b64url = (bytes) => toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (text) => fromB64(text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4));
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

export function getSecret() {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw httpError(500, "Chưa cấu hình JWT_SECRET (cần secret >= 32 ký tự). Xem mục 5 trong HUONG-DAN-CLOUDFLARE.md.");
  }
  return secret;
}

const hmacKey = (usage) => crypto.subtle.importKey("raw", enc.encode(getSecret()), { name: "HMAC", hash: "SHA-256" }, false, usage);

export async function hmacHex(text) {
  return hex(await crypto.subtle.sign("HMAC", await hmacKey(["sign"]), enc.encode(text)));
}

/* ----------------------------------- JWT ----------------------------------- */

export async function signToken(userId) {
  const header = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(enc.encode(JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_DAYS * 86400 })));
  const sig = b64url(await crypto.subtle.sign("HMAC", await hmacKey(["sign"]), enc.encode(`${header}.${payload}`)));
  return `${header}.${payload}.${sig}`;
}

export async function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(["verify"]), fromB64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* --------------------------------- Mật khẩu -------------------------------- */

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const rounds = iterations();
  return `pbkdf2$${rounds}$${toB64(salt)}$${toB64(await derive(password, salt, rounds))}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = String(stored || "").split("$");
  if (scheme !== "pbkdf2" || !salt || !hash) return false;
  const got = new Uint8Array(await derive(password, fromB64(salt), Number(iterations)));
  const want = fromB64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i += 1) diff |= got[i] ^ want[i];
  return diff === 0;
}

const sha256Hex = async (text) => hex(await crypto.subtle.digest("SHA-256", enc.encode(text)));

function checkPassword(password) {
  if (typeof password !== "string" || password.length < 8) throw httpError(400, "Mật khẩu cần ít nhất 8 ký tự.");
  if (password.length > 200) throw httpError(400, "Mật khẩu quá dài.");
}

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
function checkEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) throw httpError(400, "Email không hợp lệ.");
}

/* --------------------------------- Người dùng ------------------------------ */

export async function findUserByEmail(email) {
  const rows = await runEntityOp(SERVICE, "User", "filter", [{ email: normalizeEmail(email) }, { limit: 1 }]);
  return rows[0] ?? null;
}

export async function getUserById(id) {
  try {
    return await runEntityOp(SERVICE, "User", "get", [id]);
  } catch {
    return null;
  }
}

/** Người dùng của request (từ header Authorization: Bearer ...) hoặc null. */
export async function userFromRequest(request) {
  const header = request.headers.get("Authorization") || "";
  const m = header.match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const payload = await verifyToken(m[1]);
  if (!payload) return null;
  const user = await getUserById(payload.sub);
  if (!user || user.staff_status === LOCKED_STATUS) return null;
  return user;
}

function adminEmails() {
  return String(env.ADMIN_EMAILS || "").split(/[\s,;]+/).map(normalizeEmail).filter(Boolean);
}

async function shouldBeAdmin(email) {
  const list = adminEmails();
  if (list.length) return list.includes(email);
  // Chưa khai báo ADMIN_EMAILS: tài khoản đăng ký đầu tiên của hệ thống là admin.
  return (await runEntityOp(SERVICE, "User", "count", [{}])) === 0;
}

async function setPasswordHash(userId, hash) {
  const db = await ensureSchema();
  await db
    .prepare("INSERT INTO credentials (user_id, password_hash, reset_hash, reset_expires) VALUES (?, ?, NULL, NULL) ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash, reset_hash = NULL, reset_expires = NULL")
    .bind(userId, hash)
    .run();
}

/* --------------------------------- Chống dò mật khẩu ----------------------- */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

async function throttle(key) {
  const db = await ensureSchema();
  const since = Date.now() - WINDOW_MS;
  const row = await db.prepare("SELECT COUNT(*) AS n FROM auth_attempts WHERE key = ? AND at > ?").bind(key, since).first();
  if ((row?.n ?? 0) >= MAX_FAILS) throw httpError(429, "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.");
}

const recordFailure = async (key) => (await ensureSchema()).prepare("INSERT INTO auth_attempts (key, at) VALUES (?, ?)").bind(key, Date.now()).run();
const clearFailures = async (key) => (await ensureSchema()).prepare("DELETE FROM auth_attempts WHERE key = ?").bind(key).run();
const sweepAttempts = async () => (await ensureSchema()).prepare("DELETE FROM auth_attempts WHERE at < ?").bind(Date.now() - 24 * 3600 * 1000).run();

/* ---------------------------------- Hành động ------------------------------ */

export async function register({ email, password, full_name }) {
  email = normalizeEmail(email);
  checkEmail(email);
  checkPassword(password);
  const existing = await findUserByEmail(email);
  const db = await ensureSchema();
  if (existing) {
    const cred = await db.prepare("SELECT password_hash FROM credentials WHERE user_id = ?").bind(existing.id).first();
    if (cred?.password_hash) throw httpError(409, "Email này đã được đăng ký. Hãy đăng nhập hoặc dùng quên mật khẩu.");
  }
  const admin = await shouldBeAdmin(email);
  const name = typeof full_name === "string" && full_name.trim() ? full_name.trim().slice(0, 100) : email.split("@")[0];
  // Tài khoản được mời nhưng chưa đặt mật khẩu: đăng ký sẽ hoàn tất tài khoản đó (giữ vai trò đã cấp).
  const user = existing ?? (await runEntityOp(SERVICE, "User", "create", [{ email, full_name: name, role: admin ? "admin" : "user" }]));
  if (existing && admin && existing.role !== "admin") await runEntityOp(SERVICE, "User", "update", [existing.id, { role: "admin" }]);
  await setPasswordHash(user.id, await hashPassword(password));
  const fresh = (await getUserById(user.id)) ?? user;
  return { access_token: await signToken(user.id), user: fresh };
}

export async function login({ email, password }) {
  email = normalizeEmail(email);
  if (!email || typeof password !== "string") throw httpError(400, "Vui lòng nhập email và mật khẩu.");
  const key = `login:${email}`;
  await throttle(key);
  const user = await findUserByEmail(email);
  const db = await ensureSchema();
  const cred = user ? await db.prepare("SELECT password_hash FROM credentials WHERE user_id = ?").bind(user.id).first() : null;
  // Luôn băm một lần để thời gian phản hồi không lộ email có tồn tại hay không.
  const ok = await verifyPassword(password, cred?.password_hash ?? `pbkdf2$${iterations()}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`);
  if (!user || !cred?.password_hash || !ok) {
    await recordFailure(key);
    throw httpError(401, "Email hoặc mật khẩu không đúng.");
  }
  if (user.staff_status === LOCKED_STATUS) throw httpError(403, "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.");
  await clearFailures(key);
  if (Math.random() < 0.05) await sweepAttempts();
  return { access_token: await signToken(user.id), user };
}

async function issueResetToken(userId, hours) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const db = await ensureSchema();
  await db
    .prepare("INSERT INTO credentials (user_id, password_hash, reset_hash, reset_expires) VALUES (?, NULL, ?, ?) ON CONFLICT(user_id) DO UPDATE SET reset_hash = excluded.reset_hash, reset_expires = excluded.reset_expires")
    .bind(userId, await sha256Hex(token), Date.now() + hours * 3600 * 1000)
    .run();
  return token;
}

const siteName = () => env.SITE_NAME || "GenTravel";

export async function requestPasswordReset({ email }, origin) {
  email = normalizeEmail(email);
  const user = email ? await findUserByEmail(email) : null;
  if (!user || user.staff_status === LOCKED_STATUS) return { ok: true };
  await throttle(`reset:${email}`);
  await recordFailure(`reset:${email}`); // tận dụng bộ đếm: tối đa 8 yêu cầu / 15 phút
  const token = await issueResetToken(user.id, 1);
  const link = `${origin}/reset-password?token=${token}`;
  try {
    await sendEmail({
      to: email,
      subject: `${siteName()} · Đặt lại mật khẩu`,
      body: `Xin chào ${user.full_name || ""},\n\nBấm vào liên kết sau để đặt lại mật khẩu (có hiệu lực 1 giờ):\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
    });
  } catch (error) {
    console.error("Không gửi được email đặt lại mật khẩu:", error?.message);
  }
  return { ok: true };
}

export async function resetPassword({ resetToken, newPassword }) {
  checkPassword(newPassword);
  if (typeof resetToken !== "string" || resetToken.length < 32 || resetToken.length > 200) throw httpError(400, "Liên kết đặt lại mật khẩu không hợp lệ.");
  const db = await ensureSchema();
  const row = await db.prepare("SELECT user_id, reset_expires FROM credentials WHERE reset_hash = ?").bind(await sha256Hex(resetToken)).first();
  if (!row || !row.reset_expires || row.reset_expires < Date.now()) throw httpError(400, "Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.");
  await setPasswordHash(row.user_id, await hashPassword(newPassword));
  return { ok: true };
}

/** Quản trị viên mời nhân sự: tạo tài khoản chưa có mật khẩu + gửi liên kết đặt mật khẩu (hiệu lực 7 ngày). */
export async function inviteUser({ email, role }, origin) {
  email = normalizeEmail(email);
  checkEmail(email);
  const roleValue = role === "admin" ? "admin" : "user";
  let user = await findUserByEmail(email);
  if (!user) user = await runEntityOp(SERVICE, "User", "create", [{ email, full_name: email.split("@")[0], role: roleValue }]);
  else if (user.role !== roleValue) user = await runEntityOp(SERVICE, "User", "update", [user.id, { role: roleValue }]);
  const token = await issueResetToken(user.id, 24 * 7);
  const link = `${origin}/reset-password?token=${token}`;
  let emailSent = false;
  try {
    await sendEmail({
      to: email,
      subject: `${siteName()} · Lời mời tham gia quản trị`,
      body: `Bạn được mời tham gia ${siteName()}.\n\nBấm vào liên kết sau để đặt mật khẩu và đăng nhập (có hiệu lực 7 ngày):\n${link}`,
    });
    emailSent = true;
  } catch (error) {
    console.error("Không gửi được email mời:", error?.message);
  }
  return { ok: true, email_sent: emailSent, invite_link: emailSent ? undefined : link, user };
}

export { newId };
