// Bộ định tuyến API của Worker (chạy trước TanStack Start):
//   POST /api/data              { entity, method, args }  → đọc/ghi dữ liệu theo quyền của người gọi
//   POST /api/auth/{register,login,forgot,reset,invite}   GET /api/auth/me
//   POST /api/files/upload      (multipart: file, private=1)    POST /api/files/signed { file_uri }
//   POST /api/ai/invoke         { prompt, response_json_schema } (chỉ admin)
//   GET  /files/public/*, /files/signed
import { inviteUser, login, register, requestPasswordReset, resetPassword, userFromRequest } from "./auth.server";
import { invokeLLM } from "./ai.server";
import { serveFile, signedUrl, uploadFile } from "./files.server";
import { ensureSchema, httpError, runEntityOp } from "./store.server";

const json = (data, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });
const MAX_JSON_BYTES = 2_000_000;

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_JSON_BYTES) throw httpError(413, "Dữ liệu gửi lên quá lớn.");
  try {
    return await request.json();
  } catch {
    throw httpError(400, "Dữ liệu JSON không hợp lệ.");
  }
}

const sameOrigin = (request) => {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
};

async function route(request, url) {
  const { pathname } = url;
  const origin = url.origin;

  if (request.method === "GET" && (pathname.startsWith("/files/public/") || pathname === "/files/signed")) return serveFile(url);

  if (pathname === "/api/health" && request.method === "GET") {
    await ensureSchema();
    return json({ ok: true });
  }

  if (pathname === "/api/auth/me" && request.method === "GET") {
    const user = await userFromRequest(request);
    return user ? json({ user }) : json({ error: "Chưa đăng nhập." }, 401);
  }

  if (request.method !== "POST") throw httpError(405, "Phương thức không được hỗ trợ.");
  if (!sameOrigin(request)) throw httpError(403, "Yêu cầu từ nguồn không được phép.");

  if (pathname === "/api/data") {
    const { entity, method, args } = await readJson(request);
    if (typeof entity !== "string" || typeof method !== "string") throw httpError(400, "Thiếu entity hoặc method.");
    const user = await userFromRequest(request);
    return json({ data: await runEntityOp({ user, bypass: false }, entity, method, args ?? []) });
  }

  if (pathname === "/api/auth/register") return json(await register(await readJson(request)));
  if (pathname === "/api/auth/login") return json(await login(await readJson(request)));
  if (pathname === "/api/auth/forgot") return json(await requestPasswordReset(await readJson(request), origin));
  if (pathname === "/api/auth/reset") return json(await resetPassword(await readJson(request)));

  const user = await userFromRequest(request);
  if (!user) throw httpError(401, "Chưa đăng nhập.");
  const isAdmin = user.role === "admin";

  if (pathname === "/api/auth/invite") {
    if (!isAdmin) throw httpError(403, "Chỉ quản trị viên được mời nhân sự.");
    const { email, role } = await readJson(request);
    return json(await inviteUser({ email, role }, origin));
  }
  if (pathname === "/api/files/upload") {
    if (!isAdmin) throw httpError(403, "Chỉ quản trị viên được tải file lên.");
    const form = await request.formData();
    const isPrivate = ["1", "true"].includes(String(form.get("private") || ""));
    return json(await uploadFile(form.get("file"), { isPrivate, uploader: user.id }));
  }
  if (pathname === "/api/files/signed") {
    if (!isAdmin) throw httpError(403, "Chỉ quản trị viên được mở chứng từ.");
    return json(await signedUrl((await readJson(request)).file_uri, origin));
  }
  if (pathname === "/api/ai/invoke") {
    if (!isAdmin) throw httpError(403, "Chỉ quản trị viên được dùng AI.");
    return json(await invokeLLM(await readJson(request)));
  }
  throw httpError(404, "Không tìm thấy API.");
}

export const isApiPath = (pathname) => pathname.startsWith("/api/") && !pathname.startsWith("/api/vietqr-webhook") && pathname !== "/api/diag" || pathname.startsWith("/files/");

export async function handleApi(request) {
  const url = new URL(request.url);
  try {
    return await route(request, url);
  } catch (error) {
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
    if (status >= 500) console.error("API lỗi:", url.pathname, error?.stack || error);
    return json({ error: status >= 500 && !error?.status ? "Lỗi máy chủ." : error.message, ...(error?.data ? { data: error.data } : {}) }, status);
  }
}
