import { createFileRoute } from "@tanstack/react-router";
import { runDiagnostics } from "@/lib/diag.server";

export const Route = createFileRoute("/api/diag")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(await runDiagnostics(), null, 2), {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        }),
    },
  },
});
