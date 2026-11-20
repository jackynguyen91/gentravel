// Điểm vào của Cloudflare Worker.
//  - /api/data, /api/auth/*, /api/files/*, /files/*  → backend riêng (D1 + R2) trong src/server
//  - Mọi request còn lại do TanStack Start xử lý (SSR, server function, /api/vietqr-webhook, /api/diag)
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { handleApi, isApiPath } from "@/server/api.server";

const startHandler = createStartHandler(defaultStreamHandler);

export default {
  fetch(request, env, ctx) {
    if (isApiPath(new URL(request.url).pathname)) return handleApi(request);
    return startHandler(request, env, ctx);
  },
};
