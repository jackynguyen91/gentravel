// Làm sạch HTML do biên tập viên soạn trước khi hiển thị ra website.
export function safeArticleHtml(html, sourceSlug) {
  let out = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");

  // Gắn mã bài viết vào liên kết tour để đơn đặt tour ghi nhận đúng nguồn.
  if (sourceSlug) {
    out = out.replace(
      /href="(\/tours\/[^"?#]+)"/g,
      (_match, path) => `href="${path}?bai_viet=${encodeURIComponent(sourceSlug)}"`,
    );
  }
  return out;
}