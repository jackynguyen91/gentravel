export const POST_STATUSES = ["Nháp", "Chờ duyệt", "Đã lên lịch", "Đã đăng", "Lưu trữ"];

export const STATUS_STYLE = {
  "Nháp": "border-slate-200 bg-slate-100 text-slate-600",
  "Chờ duyệt": "border-amber-200 bg-amber-50 text-amber-700",
  "Đã lên lịch": "border-sky-200 bg-sky-50 text-sky-700",
  "Đã đăng": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Lưu trữ": "border-slate-200 bg-slate-50 text-slate-500",
};

export const DEFAULT_CATEGORIES = [
  "Kinh nghiệm",
  "Điểm đến",
  "Ẩm thực",
  "Tin GenTravel",
  "Visa & thủ tục",
  "Mẹo du lịch",
  "Lịch trình mẫu",
];

export const statusOf = (post) => post?.status || "Đã đăng";

export function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(text) {
  const clean = String(text || "").trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

export const readMinutes = (words) => Math.max(1, Math.round((Number(words) || 0) / 200));

export function plainContent(post) {
  if (post?.content_html) return stripHtml(post.content_html);
  return String(post?.content || "");
}

export function isPublished(post, now = new Date()) {
  const status = statusOf(post);
  if (post?.archived) return false;
  if (status === "Đã đăng") return true;
  if (status === "Đã lên lịch") {
    return post.scheduled_at ? new Date(post.scheduled_at) <= now : true;
  }
  return false;
}

const imgTags = (html) => String(html || "").match(/<img\b[^>]*>/gi) || [];

export function seoChecks(form) {
  const html = String(form?.content_html || "");
  const words = countWords(stripHtml(html));
  const metaTitle = String(form?.meta_title || form?.title || "").trim();
  const metaDescription = String(form?.meta_description || form?.summary || "").trim();
  const images = imgTags(html);
  const altsOk = images.every((tag) => /alt\s*=\s*["'][^"']+["']/i.test(tag));
  const internalLinks = /href\s*=\s*["']\//i.test(html);
  const hasCta = /data-cta/i.test(html) || Boolean(form?.cta_label);
  const h1Count = (html.match(/<h1\b/gi) || []).length;

  const checks = [
    { key: "h1", label: "Có đúng 1 thẻ H1", pass: h1Count === 1, hint: h1Count === 0 ? "Thêm một tiêu đề H1 trong nội dung." : "Đang có nhiều hơn 1 H1." },
    { key: "title", label: "Meta title 40–65 ký tự", pass: metaTitle.length >= 40 && metaTitle.length <= 65, hint: `Hiện ${metaTitle.length} ký tự.` },
    { key: "desc", label: "Meta description 120–160 ký tự", pass: metaDescription.length >= 120 && metaDescription.length <= 160, hint: `Hiện ${metaDescription.length} ký tự.` },
    { key: "alt", label: "Mọi ảnh đều có alt", pass: images.length ? altsOk : false, hint: images.length ? "Kiểm tra chú thích ảnh." : "Bài chưa có ảnh trong nội dung." },
    { key: "length", label: "Bài dài từ 300 từ", pass: words >= 300, hint: `Hiện ${words} từ.` },
    { key: "links", label: "Có liên kết nội bộ", pass: internalLinks, hint: "Thêm liên kết tới tour, dịch vụ hoặc bài khác." },
    { key: "cta", label: "Có nút kêu gọi hành động", pass: hasCta, hint: "Chèn khối CTA trong nội dung." },
    { key: "destination", label: "Có điểm đến hoặc tag", pass: Boolean(form?.destination) || (form?.tags || []).length > 0, hint: "Gắn điểm đến và tag cho bài." },
  ];
  const passed = checks.filter((check) => check.pass).length;
  return { checks, passed, total: checks.length, score: Math.round((passed / checks.length) * 100), words };
}