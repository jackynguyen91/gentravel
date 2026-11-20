// Gửi email qua Resend (https://resend.com). Cần secret RESEND_API_KEY và biến MAIL_FROM.
// Nếu chưa cấu hình, sendEmail ném lỗi — nơi gọi quyết định bỏ qua hay báo lại cho người dùng.
import { env } from "cloudflare:workers";
import { httpError } from "./store.server";

const list = (value) => (Array.isArray(value) ? value : String(value || "").split(/[,;]+/)).map((s) => s.trim()).filter(Boolean);
const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const emailConfigured = () => Boolean(env.RESEND_API_KEY && env.MAIL_FROM);

export async function sendEmail({ to, subject, body, html, text, attachments, from_name }) {
  if (!emailConfigured()) throw httpError(501, "Chưa cấu hình gửi email (RESEND_API_KEY và MAIL_FROM).");
  const recipients = list(to);
  if (!recipients.length) throw httpError(400, "Thiếu người nhận email.");
  const plain = text ?? body;
  const payload = {
    from: from_name ? `${from_name.replace(/[<>"]/g, "")} <${String(env.MAIL_FROM).replace(/^.*<|>.*$/g, "")}>` : env.MAIL_FROM,
    to: recipients.slice(0, 50),
    subject: String(subject || "(không tiêu đề)").slice(0, 300),
    html: html ?? `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.55">${escapeHtml(plain ?? "").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</div>`,
    ...(plain ? { text: plain } : {}),
    ...(Array.isArray(attachments) && attachments.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })) } : {}),
  };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw httpError(502, `Resend từ chối gửi email (${response.status}): ${detail.slice(0, 300)}`);
  }
  return { ok: true };
}
