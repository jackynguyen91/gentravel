// InvokeLLM thay thế bằng Cloudflare Workers AI (binding AI). Dùng cho gợi ý SEO bài viết.
import { env } from "cloudflare:workers";
import { httpError } from "./store.server";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export async function invokeLLM({ prompt, response_json_schema }) {
  if (!env.AI) throw httpError(501, "Chưa bật Workers AI (binding AI).");
  const text = String(prompt || "").slice(0, 12000);
  const wantJson = response_json_schema && typeof response_json_schema === "object";
  const system = wantJson
    ? `Chỉ trả lời bằng MỘT đối tượng JSON hợp lệ khớp schema sau, không thêm chữ nào khác:\n${JSON.stringify(response_json_schema)}`
    : "Trả lời bằng tiếng Việt, ngắn gọn.";
  const result = await env.AI.run(MODEL, { messages: [{ role: "system", content: system }, { role: "user", content: text }], max_tokens: 1200 });
  const raw = typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? "");
  if (!wantJson) return raw;
  const match = raw.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : raw);
  } catch {
    throw httpError(502, "AI trả về dữ liệu không đúng định dạng, hãy thử lại.");
  }
}
