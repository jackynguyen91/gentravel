import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clock, Eye, Loader2, Save, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import RichTextEditor from "@/components/admin/blog/RichTextEditor";
import SeoPanel from "@/components/admin/blog/SeoPanel";
import VersionHistory from "@/components/admin/blog/VersionHistory";
import PostPreview from "@/components/admin/blog/PostPreview";
import { savePost, suggestPostSeo } from "@/lib/admin-blog-fns";
import { countWords, readMinutes, STATUS_STYLE } from "@/lib/blog-catalog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const label = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const input = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-ink outline-none focus:border-brand";

const escapeHtml = (text) =>
  String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Bài cũ lưu nội dung dạng chữ thuần: đổi sang đoạn HTML khi mở để soạn tiếp mà không mất nội dung.
const legacyHtml = (text) =>
  String(text || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br/>")}</p>`)
    .join("");

const initialForm = (post, author) => {
  const base = post ? { ...emptyForm(author), ...post } : emptyForm(author);
  if (!base.content_html && base.content) base.content_html = legacyHtml(base.content);
  return base;
};

const emptyForm = (author) => ({
  title: "",
  slug: "",
  summary: "",
  thumbnail: "",
  thumbnail_alt: "",
  category: "Kinh nghiệm",
  tags: [],
  destination: "",
  destination_id: "",
  author: author || "",
  published_at: "",
  scheduled_at: "",
  featured: false,
  comments_enabled: true,
  status: "Nháp",
  meta_title: "",
  meta_description: "",
  og_image: "",
  canonical_url: "",
  noindex: false,
  content_html: "",
  related_tour_ids: [],
  related_service_ids: [],
});

export default function PostEditor({ post, options, categories, userId, canApprove, canWrite }) {
  const navigate = useNavigate();
  const save = useServerFn(savePost);
  const suggest = useServerFn(suggestPostSeo);

  const [form, setForm] = useState(() => initialForm(post, post?.author));
  const [suggestions, setSuggestions] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState("");
  const [lastSaved, setLastSaved] = useState(post?.updated_date || "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const dirtyRef = useRef(false);

  const readOnly = Boolean(post) && !canApprove && post.created_by_id !== userId;
  const words = countWords(String(form.content_html || "").replace(/<[^>]+>/g, " "));
  const status = form.status || "Nháp";

  const set = (key, value) => {
    dirtyRef.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const setField = (key) => (event) => set(key, event.target.value);

  const persist = async (nextStatus, extra = {}) => {
    if (readOnly) return;
    if (form.title.trim().length < 2) {
      toast.error("Nhập tiêu đề bài viết trước khi lưu.");
      return;
    }
    setSaving(nextStatus);
    try {
      const result = await save({
        data: {
          id: post?.id,
          ...form,
          ...extra,
          status: nextStatus,
          content: undefined,
        },
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      dirtyRef.current = false;
      setLastSaved(new Date().toISOString());
      setForm((prev) => ({ ...prev, status: result.status || nextStatus, slug: result.slug || prev.slug }));
      toast.success(nextStatus === "Chờ duyệt" ? "Đã gửi duyệt bài viết" : "Đã lưu bài viết");
      if (!post?.id) {
        navigate({ to: "/admin/blog/$postId", params: { postId: result.id }, replace: true });
      }
    } catch {
      toast.error("Chưa lưu được bài viết. Vui lòng thử lại.");
    } finally {
      setSaving("");
    }
  };

  // Tự lưu nháp mỗi 30 giây khi có thay đổi.
  useEffect(() => {
    if (readOnly) return undefined;
    const timer = setInterval(() => {
      if (!dirtyRef.current || !form.title.trim() || saving) return;
      persist(form.status === "Nháp" || !post ? "Nháp" : form.status);
    }, 30000);
    return () => clearInterval(timer);
  }, [form, saving, readOnly, post]);

  const runSuggest = async () => {
    setSuggesting(true);
    const result = await suggest({ data: { title: form.title, content_html: form.content_html, destination: form.destination } });
    setSuggesting(false);
    if (result?.error) return toast.error(result.error);
    setSuggestions(result);
  };

  const applySuggestion = (key, value) => {
    if (key === "tags") set("tags", value);
    else set(key, value);
  };

  const restoreVersion = (version) => {
    setForm((prev) => ({
      ...prev,
      title: version.title || prev.title,
      summary: version.summary ?? prev.summary,
      content_html: version.content_html || prev.content_html,
      meta_title: version.meta_title || prev.meta_title,
      meta_description: version.meta_description || prev.meta_description,
    }));
    setLastSaved("");
    dirtyRef.current = true;
    toast.success("Đã khôi phục bản cũ, bấm Lưu để áp dụng");
  };

  const toggleId = (key, id) => {
    const list = form[key] || [];
    set(key, list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const autoSuggestRelated = () => {
    const tours = options.tours.filter((tour) => tour.destination && tour.destination === form.destination).slice(0, 4).map((tour) => tour.id);
    const services = options.services
      .filter((service) => service.destination && service.destination === form.destination)
      .slice(0, 4)
      .map((service) => service.id);
    set("related_tour_ids", [...new Set([...(form.related_tour_ids || []), ...tours])]);
    set("related_service_ids", [...new Set([...(form.related_service_ids || []), ...services])]);
    toast.success(`Đã gợi ý ${tours.length} tour và ${services.length} dịch vụ cùng điểm đến`);
  };

  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    set("tags", [...new Set([...(form.tags || []), value])]);
    setTagInput("");
  };

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/admin/blog" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-brand" aria-label="Quay lại danh sách">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-heading text-xl font-extrabold tracking-tight text-ink">{post ? "Chỉnh sửa bài viết" : "Soạn bài mới"}</h1>
            <p className="text-[11.5px] text-slate-500">
              <span className={`mr-1 rounded-full border px-1.5 py-0.5 text-[10.5px] font-semibold ${STATUS_STYLE[status] || STATUS_STYLE["Nháp"]}`}>{status}</span>
              {words} từ · đọc ~{readMinutes(words)} phút
              {lastSaved ? ` · lưu lúc ${new Date(lastSaved).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600">
            <Eye className="h-3.5 w-3.5" /> Xem trước
          </button>
          {!readOnly && canWrite ? (
            <>
              <button type="button" onClick={() => persist("Nháp")} disabled={Boolean(saving)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600 disabled:opacity-60">
                {saving === "Nháp" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Lưu nháp
              </button>
              {canApprove ? (
                <>
                  <button type="button" onClick={() => persist("Đã đăng", { published_at: form.published_at || new Date().toISOString().slice(0, 10) })} disabled={Boolean(saving)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-white disabled:opacity-60">
                    {saving === "Đã đăng" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Đăng bài
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => persist("Chờ duyệt")} disabled={Boolean(saving)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-white disabled:opacity-60">
                  {saving === "Chờ duyệt" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Gửi duyệt
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {readOnly ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-medium text-amber-800">
          Bạn chỉ sửa được bài của mình. Bài này do {post.author || "người khác"} phụ trách nên chỉ xem được.
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-100 bg-white p-3.5">
            <input
              value={form.title}
              onChange={setField("title")}
              disabled={readOnly}
              placeholder="Tiêu đề bài viết"
              className="w-full border-0 border-b border-slate-100 pb-2 font-heading text-xl font-extrabold text-ink outline-none placeholder:text-slate-300 focus:border-brand"
            />
            <div className="mt-2">
              <label className={label}>Tóm tắt</label>
              <textarea rows={2} value={form.summary} onChange={setField("summary")} disabled={readOnly} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] outline-none focus:border-brand" placeholder="2 câu mô tả ngắn hiển thị ở danh sách và Google" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[12px] font-bold text-ink">Nội dung bài viết</p>
              <p className="text-[11px] text-slate-400">H2/H3, in đậm, danh sách, trích dẫn, bảng, liên kết, ảnh, video</p>
            </div>
            {readOnly ? (
              <div className="rounded-lg border border-slate-100 p-3 text-[13px] leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: form.content_html || "<p><em>Bài chưa có nội dung.</em></p>" }} />
            ) : (
              <RichTextEditor
                key={post?.id || "new"}
                initialHtml={form.content_html}
                onChange={(html) => set("content_html", html)}
                tours={options.tours}
                services={options.services}
              />
            )}
          </div>
        </div>

        <div className="space-y-3">
          <section className="rounded-xl border border-slate-100 bg-white p-3.5">
            <h2 className="text-[13px] font-bold text-ink">Xuất bản</h2>
            <div className="mt-2 space-y-2">
              <div>
                <label className={label}>Trạng thái</label>
                <select value={form.status} onChange={setField("status")} disabled={readOnly} className={input}>
                  {(canApprove ? ["Nháp", "Chờ duyệt", "Đã lên lịch", "Đã đăng", "Lưu trữ"] : ["Nháp", "Chờ duyệt"]).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Lên lịch đăng</label>
                <input type="datetime-local" value={form.scheduled_at || ""} onChange={setField("scheduled_at")} disabled={readOnly} className={input} />
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <input type="checkbox" checked={Boolean(form.featured)} onChange={(event) => set("featured", event.target.checked)} disabled={readOnly} className="h-3.5 w-3.5 rounded border-slate-300 text-brand" />
                Bài nổi bật
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <input type="checkbox" checked={form.comments_enabled !== false} onChange={(event) => set("comments_enabled", event.target.checked)} disabled={readOnly} className="h-3.5 w-3.5 rounded border-slate-300 text-brand" />
                Bật bình luận
              </label>
              {canApprove && form.status === "Đã lên lịch" ? (
                <button type="button" onClick={() => persist("Đã lên lịch")} disabled={Boolean(saving)} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-sky-600 text-[12px] font-semibold text-white disabled:opacity-60">
                  <Clock className="h-3.5 w-3.5" /> Lưu lịch đăng
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3.5">
            <h2 className="text-[13px] font-bold text-ink">Thông tin bài viết</h2>
            <div className="mt-2 space-y-2">
              <div>
                <label className={label}>Đường dẫn (slug)</label>
                <input className={input} value={form.slug} onChange={setField("slug")} disabled={readOnly} placeholder="de trong de tu tao" />
              </div>
              <div>
                <label className={label}>Chuyên mục</label>
                <select className={input} value={form.category} onChange={setField("category")} disabled={readOnly}>
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Điểm đến</label>
                <select className={input} value={form.destination} onChange={setField("destination")} disabled={readOnly}>
                  <option value="">Chưa gắn</option>
                  {options.destinations.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Tác giả</label>
                <input className={input} value={form.author} onChange={setField("author")} disabled={readOnly} />
              </div>
              <div>
                <label className={label}>Tags</label>
                <div className="flex gap-1.5">
                  <input
                    className={input}
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    disabled={readOnly}
                    placeholder="Nhập tag rồi Enter"
                  />
                  <button type="button" onClick={addTag} disabled={readOnly} className="h-9 shrink-0 rounded-lg border border-slate-200 px-2 text-[12px] font-semibold text-slate-600">
                    Thêm
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(form.tags || []).map((tag) => (
                    <button key={tag} type="button" onClick={() => set("tags", form.tags.filter((item) => item !== tag))} disabled={readOnly} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:text-red-600">
                      {tag} ×
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={label}>Ảnh đại diện (URL)</label>
                <input className={input} value={form.thumbnail} onChange={setField("thumbnail")} disabled={readOnly} placeholder="https://…" />
              </div>
              <div>
                <label className={label}>Mô tả ảnh đại diện (alt)</label>
                <input className={input} value={form.thumbnail_alt} onChange={setField("thumbnail_alt")} disabled={readOnly} placeholder="Mô tả nội dung ảnh" />
              </div>
              {post?.published_at ? (
                <div>
                  <label className={label}>Ngày đăng</label>
                  <input type="date" className={input} value={String(form.published_at || "").slice(0, 10)} onChange={setField("published_at")} disabled={readOnly} />
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-bold text-ink">Tour & dịch vụ liên quan</h2>
              <button type="button" onClick={autoSuggestRelated} disabled={readOnly || !form.destination} className="inline-flex h-7 items-center gap-1 rounded-md border border-brand/30 bg-brand-50 px-2 text-[11px] font-semibold text-brand disabled:opacity-50">
                <Sparkles className="h-3 w-3" /> Gợi ý
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Tự gợi ý các tour/dịch vụ cùng điểm đến “{form.destination || "chưa chọn"}”.</p>
            <div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-slate-100 p-1.5">
              {options.tours.map((tour) => (
                <label key={tour.id} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[11.5px] text-slate-600 hover:bg-slate-50">
                  <input type="checkbox" checked={(form.related_tour_ids || []).includes(tour.id)} onChange={() => toggleId("related_tour_ids", tour.id)} disabled={readOnly} className="h-3 w-3 rounded border-slate-300 text-brand" />
                  <span className="truncate">{tour.title}</span>
                </label>
              ))}
            </div>
            <div className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-slate-100 p-1.5">
              {options.services.map((service) => (
                <label key={service.id} className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[11.5px] text-slate-600 hover:bg-slate-50">
                  <input type="checkbox" checked={(form.related_service_ids || []).includes(service.id)} onChange={() => toggleId("related_service_ids", service.id)} disabled={readOnly} className="h-3 w-3 rounded border-slate-300 text-brand" />
                  <span className="truncate">{service.title}</span>
                </label>
              ))}
            </div>
          </section>

          <SeoPanel form={form} set={set} onSuggest={runSuggest} suggesting={suggesting} suggestions={suggestions} onApply={applySuggestion} />

          <VersionHistory versions={post?.versions || []} onRestore={restoreVersion} />
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl p-0">
          <DialogTitle className="sr-only">Xem trước bài viết</DialogTitle>
          <PostPreview form={form} />
        </DialogContent>
      </Dialog>
    </div>
  );
}