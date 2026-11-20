import { Loader2, Sparkles } from "lucide-react";
import { seoChecks } from "@/lib/blog-catalog";

const label = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const input = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-ink outline-none focus:border-brand";

const tone = (length, min, max) =>
  length === 0 ? "text-slate-400" : length >= min && length <= max ? "text-emerald-600" : "text-amber-600";

export default function SeoPanel({ form, set, onSuggest, suggesting, suggestions, onApply }) {
  const { score, checks, passed, total } = seoChecks(form);
  const metaTitle = form.meta_title || form.title || "";
  const metaDescription = form.meta_description || form.summary || "";
  const slugUrl = `/cam-nang/${form.slug || "duong-dan-bai-viet"}`;

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold text-ink">SEO & chia sẻ</h2>
        <button
          type="button"
          onClick={onSuggest}
          disabled={suggesting}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-brand/30 bg-brand-50 px-2 text-[11px] font-semibold text-brand disabled:opacity-60"
        >
          {suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Gợi ý AI
        </button>
      </div>

      <div className="mt-2.5 space-y-2.5">
        <div>
          <label className={label}>
            Meta title <span className={`font-normal normal-case ${tone(metaTitle.length, 40, 65)}`}>{metaTitle.length}/65</span>
          </label>
          <input className={input} value={form.meta_title} onChange={(event) => set("meta_title", event.target.value)} placeholder="Tiêu đề hiển thị trên Google" />
        </div>
        <div>
          <label className={label}>
            Meta description <span className={`font-normal normal-case ${tone(metaDescription.length, 120, 160)}`}>{metaDescription.length}/160</span>
          </label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] outline-none focus:border-brand"
            value={form.meta_description}
            onChange={(event) => set("meta_description", event.target.value)}
            placeholder="Tóm tắt hấp dẫn hiển thị trên Google"
          />
        </div>
        <div>
          <label className={label}>Ảnh chia sẻ mạng xã hội (OG image)</label>
          <input className={input} value={form.og_image} onChange={(event) => set("og_image", event.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className={label}>Canonical URL</label>
          <input className={input} value={form.canonical_url} onChange={(event) => set("canonical_url", event.target.value)} placeholder={slugUrl} />
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
          <input type="checkbox" checked={Boolean(form.noindex)} onChange={(event) => set("noindex", event.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand" />
          Không cho máy tìm kiếm lập chỉ mục (noindex)
        </label>
      </div>

      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">Xem trước trên Google</p>
        <p className="mt-1 line-clamp-2 text-[13.5px] font-medium text-[#1a0dab]">{metaTitle || "Tiêu đề bài viết"}</p>
        <p className="text-[11.5px] text-[#006621]">gentravel.vn{slugUrl}</p>
        <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-slate-600">{metaDescription || "Mô tả ngắn của bài viết sẽ hiển thị tại đây."}</p>
      </div>

      <div className="mt-3 rounded-lg border border-slate-100 p-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold text-ink">Điểm SEO</p>
          <span className={`text-[13px] font-extrabold ${score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600"}`}>
            {score}/100
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full ${score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${score}%` }} />
        </div>
        <ul className="mt-2 space-y-1">
          {checks.map((check) => (
            <li key={check.key} className="flex items-start gap-1.5 text-[11.5px] leading-snug">
              <span className={check.pass ? "text-emerald-600" : "text-amber-600"}>{check.pass ? "✓" : "!"}</span>
              <span className={check.pass ? "text-slate-500" : "text-slate-600"}>
                {check.label}
                {!check.pass ? <span className="text-slate-400"> · {check.hint}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[10.5px] text-slate-400">
          Đạt {passed}/{total} tiêu chí.
        </p>
      </div>

      {suggestions ? (
        <div className="mt-2.5 space-y-2 rounded-lg border border-brand/20 bg-brand-50/50 p-2.5">
          <p className="text-[11px] font-semibold text-brand-900">Gợi ý — chọn để áp dụng rồi sửa lại nếu cần</p>
          {(suggestions.titles || []).map((title) => (
            <button key={title} type="button" onClick={() => onApply("meta_title", title)} className="block w-full rounded-md bg-white px-2 py-1 text-left text-[12px] text-slate-700 hover:text-brand">
              {title}
            </button>
          ))}
          {suggestions.meta_description ? (
            <button type="button" onClick={() => onApply("meta_description", suggestions.meta_description)} className="block w-full rounded-md bg-white px-2 py-1 text-left text-[11.5px] text-slate-700 hover:text-brand">
              {suggestions.meta_description}
            </button>
          ) : null}
          {suggestions.summary ? (
            <button type="button" onClick={() => onApply("summary", suggestions.summary)} className="block w-full rounded-md bg-white px-2 py-1 text-left text-[11.5px] text-slate-700 hover:text-brand">
              Tóm tắt: {suggestions.summary}
            </button>
          ) : null}
          {(suggestions.tags || []).length ? (
            <button type="button" onClick={() => onApply("tags", suggestions.tags)} className="block w-full rounded-md bg-white px-2 py-1 text-left text-[11.5px] text-slate-700 hover:text-brand">
              Tags: {suggestions.tags.join(", ")}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}