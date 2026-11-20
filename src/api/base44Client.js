// Client phía trình duyệt, giữ đúng tên/hình dạng của Base44 SDK (`base44.entities.X.list()`, `base44.auth.me()`...)
// nhưng gọi thẳng API của Worker này (/api/*), không còn phụ thuộc Base44.
import { getToken, setToken } from "@/lib/token";

async function call(path, { method = "POST", body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(path, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error || `Lỗi ${response.status}`), { status: response.status, data: payload?.data ?? null });
  }
  return payload;
}

const entityMethods = (entity) =>
  new Proxy({}, {
    get: (_t, method) => (typeof method === "string" ? async (...args) => (await call("/api/data", { body: { entity, method, args } })).data : undefined),
  });

const upload = async (file, isPrivate) => {
  const form = new FormData();
  form.append("file", file);
  if (isPrivate) form.append("private", "1");
  return call("/api/files/upload", { form });
};

const saveSession = (result) => {
  if (result?.access_token) setToken(result.access_token);
  return result;
};

export const base44 = {
  entities: new Proxy({}, { get: (_t, entity) => (typeof entity === "string" ? entityMethods(entity) : undefined) }),
  auth: {
    hasToken: () => Boolean(getToken()),
    setToken,
    me: async () => (await call("/api/auth/me", { method: "GET" })).user,
    register: async ({ email, password, full_name }) => saveSession(await call("/api/auth/register", { body: { email, password, full_name } })),
    loginViaEmailPassword: async (email, password) => saveSession(await call("/api/auth/login", { body: { email, password } })),
    resetPasswordRequest: (email) => call("/api/auth/forgot", { body: { email } }),
    resetPassword: ({ resetToken, newPassword }) => call("/api/auth/reset", { body: { resetToken, newPassword } }),
    logout: (redirectTo) => {
      setToken(null);
      if (redirectTo && typeof window !== "undefined") window.location.assign(redirectTo);
    },
    redirectToLogin: (returnTo) => {
      window.location.assign(`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`);
    },
  },
  users: {
    inviteUser: (email, role) => call("/api/auth/invite", { body: { email, role } }),
  },
  integrations: {
    Core: {
      UploadPublicFile: ({ file }) => upload(file, false),
      UploadPrivateFile: ({ file }) => upload(file, true),
      CreateFileSignedUrl: ({ file_uri }) => call("/api/files/signed", { body: { file_uri } }),
    },
  },
};
