// Client dùng bên trong Worker (server function / server route), cùng hình dạng với Base44 SDK
// để mã hiện có `context.getBase44().entities.X.list()` giữ nguyên.
//   getBase44()                → hành động với quyền của khách (RLS áp dụng)
//   getBase44().asServiceRole  → quyền hệ thống, bỏ qua RLS (chỉ dùng ở server, sau khi đã kiểm tra quyền)
import { inviteUser, userFromRequest } from "./auth.server";
import { invokeLLM } from "./ai.server";
import { sendEmail } from "./email.server";
import { signedUrl } from "./files.server";
import { httpError, runEntityOp } from "./store.server";

const entitiesFor = (ctx) =>
  new Proxy({}, {
    get: (_t, entity) =>
      typeof entity === "string"
        ? new Proxy({}, { get: (_e, method) => (typeof method === "string" ? (...args) => runEntityOp(ctx, entity, method, args) : undefined) })
        : undefined,
  });

function integrations(origin) {
  return {
    Core: {
      SendEmail: (args) => sendEmail(args),
      InvokeLLM: (args) => invokeLLM(args),
      CreateFileSignedUrl: ({ file_uri }) => signedUrl(file_uri, origin),
    },
  };
}

export function createWorkerClient(request) {
  const origin = new URL(request.url).origin;
  let userPromise;
  const currentUser = () => (userPromise ??= userFromRequest(request));
  // Quyền của khách cần biết user trước khi chạy: bọc lại bằng hàm async.
  const visitorEntities = new Proxy({}, {
    get: (_t, entity) =>
      typeof entity === "string"
        ? new Proxy({}, {
            get: (_e, method) =>
              typeof method === "string"
                ? async (...args) => runEntityOp({ bypass: false, user: await currentUser() }, entity, method, args)
                : undefined,
          })
        : undefined,
  });

  return {
    entities: visitorEntities,
    auth: {
      async me() {
        const user = await currentUser();
        if (!user) throw httpError(401, "Chưa đăng nhập.");
        return user;
      },
    },
    integrations: integrations(origin),
    users: {
      async inviteUser(email, role) {
        const user = await currentUser();
        if (user?.role !== "admin") throw httpError(403, "Chỉ quản trị viên được mời nhân sự.");
        return inviteUser({ email, role }, origin);
      },
    },
    asServiceRole: {
      entities: entitiesFor({ bypass: true, user: null }),
      integrations: integrations(origin),
    },
  };
}
