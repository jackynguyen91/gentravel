import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Megaphone,
  Quote,
  Table,
  Ticket,
  Youtube,
} from "lucide-react";

const btn =
  "grid h-8 w-8 place-items-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-ink";
const input =
  "h-8 w-full rounded-md border border-slate-200 px-2 text-[12px] outline-none focus:border-brand";

const playableId = (url) => {
  const match = String(url || "").match(/(?:v=|youtu\.be\/|embed\/)([\w-]{6,})/);
  return match ? match[1] : "";
};

export default function RichTextEditor({ initialHtml, onChange, tours = [], services = [] }) {
  const ref = useRef(null);
  const [mode, setMode] = useState("");
  const [draft, setDraft] = useState({ url: "", alt: "", caption: "", label: "", href: "", tour: "", service: "" });

  useEffect(() => {
    if (ref.current && !ref.current.innerHTML.trim()) ref.current.innerHTML = initialHtml || "";
  }, [initialHtml]);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const exec = (command, value = null) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  };

  const insert = (html) => {
    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    setMode("");
    emit();
  };

  const heading = (tag) => exec("formatBlock", `<${tag}>`);

  const insertImage = () => {
    if (!draft.url) return;
    insert(
      `<figure style="margin:1.5rem 0"><img src="${draft.url}" alt="${draft.alt || ""}" style="width:100%;border-radius:16px" />${
        draft.caption ? `<figcaption style="font-size:13px;color:#64748b;margin-top:6px">${draft.caption}</figcaption>` : ""
      }</figure><p><br/></p>`,
    );
    setDraft({ url: "", alt: "", caption: "", label: "", href: "", tour: "", service: "" });
  };

  const insertVideo = () => {
    const id = playableId(draft.url);
    if (!id) return;
    insert(
      `<div data-video style="position:relative;padding-bottom:56.25%;height:0;margin:1.5rem 0"><iframe src="https://www.youtube.com/embed/${id}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:16px" allowfullscreen></iframe></div><p><br/></p>`,
    );
    setDraft({ url: "", alt: "", caption: "", label: "", href: "", tour: "", service: "" });
  };

  const insertTable = () => {
    const row = `<tr><td style="border:1px solid #e2e8f0;padding:8px">Nội dung</td><td style="border:1px solid #e2e8f0;padding:8px">Nội dung</td><td style="border:1px solid #e2e8f0;padding:8px">Nội dung</td></tr>`;
    insert(
      `<table style="width:100%;border-collapse:collapse;margin:1.5rem 0;font-size:14px"><thead><tr><th style="border:1px solid #e2e8f0;padding:8px;text-align:left">Cột 1</th><th style="border:1px solid #e2e8f0;padding:8px;text-align:left">Cột 2</th><th style="border:1px solid #e2e8f0;padding:8px;text-align:left">Cột 3</th></tr></thead><tbody>${row}${row}</tbody></table><p><br/></p>`,
    );
  };

  const insertCta = () => {
    if (!draft.label || !draft.href) return;
    insert(
      `<p><a data-cta href="${draft.href}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 22px;border-radius:12px;font-weight:600;text-decoration:none">${draft.label}</a></p><p><br/></p>`,
    );
    setDraft({ url: "", alt: "", caption: "", label: "", href: "", tour: "", service: "" });
  };

  const insertTour = () => {
    const tour = tours.find((item) => item.id === draft.tour);
    if (!tour) return;
    insert(
      `<p data-cta data-tour="${tour.id}"><a href="/tours/${tour.slug}" style="display:block;border:1px solid #e2e8f0;border-radius:16px;padding:14px 18px;text-decoration:none;color:#0f172a"><strong>Tour gợi ý: ${tour.title}</strong><br/><span style="font-size:13px;color:#64748b">${tour.destination || ""} · Xem lịch trình và giá</span></a></p><p><br/></p>`,
    );
    setDraft({ url: "", alt: "", caption: "", label: "", href: "", tour: "", service: "" });
  };

  const insertService = () => {
    const service = services.find((item) => item.id === draft.service);
    if (!service) return;
    insert(
      `<p data-cta data-service="${service.id}"><a href="/dich-vu-khac" style="display:block;border:1px solid #e2e8f0;border-radius:16px;padding:14px 18px;text-decoration:none;color:#0f172a"><strong>Dịch vụ gợi ý: ${service.title}</strong><br/><span style="font-size:13px;color:#64748b">${service.type} · Liên hệ để nhận báo giá</span></a></p><p><br/></p>`,
    );
    setDraft({ url: "", alt: "", caption: "", label: "", href: "", tour: "", service: "" });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50/70 p-1.5">
        <button type="button" onClick={() => heading("h2")} className={btn} aria-label="Tiêu đề H2" title="Tiêu đề H2">
          <Heading2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => heading("h3")} className={btn} aria-label="Tiêu đề H3" title="Tiêu đề H3">
          <Heading3 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => exec("bold")} className={btn} aria-label="In đậm" title="In đậm">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => exec("italic")} className={btn} aria-label="In nghiêng" title="In nghiêng">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => exec("insertUnorderedList")} className={btn} aria-label="Danh sách" title="Danh sách">
          <List className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => exec("insertOrderedList")} className={btn} aria-label="Danh sách số" title="Danh sách số">
          <ListOrdered className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => heading("blockquote")} className={btn} aria-label="Trích dẫn" title="Trích dẫn">
          <Quote className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Dán liên kết (URL):", "https://");
            if (url) exec("createLink", url);
          }}
          className={btn}
          aria-label="Chèn liên kết"
          title="Chèn liên kết"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setMode(mode === "image" ? "" : "image")} className={btn} aria-label="Chèn ảnh" title="Chèn ảnh">
          <ImageIcon className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setMode(mode === "video" ? "" : "video")} className={btn} aria-label="Chèn video YouTube" title="Chèn video YouTube">
          <Youtube className="h-4 w-4" />
        </button>
        <button type="button" onClick={insertTable} className={btn} aria-label="Chèn bảng" title="Chèn bảng">
          <Table className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button type="button" onClick={() => setMode(mode === "cta" ? "" : "cta")} className={btn} aria-label="Chèn nút CTA" title="Nút kêu gọi hành động">
          <Megaphone className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setMode(mode === "tour" ? "" : "tour")} className={btn} aria-label="Chèn khối tour" title="Khối tour gợi ý">
          <Ticket className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setMode(mode === "service" ? "" : "service")} className={btn} aria-label="Chèn khối dịch vụ" title="Khối dịch vụ gợi ý">
          <span className="text-[11px] font-bold">DV</span>
        </button>
      </div>

      {mode ? (
        <div className="space-y-2 border-b border-slate-100 bg-brand-50/40 p-3">
          {mode === "image" ? (
            <>
              <input className={input} placeholder="URL ảnh" value={draft.url} onChange={(e) => setDraft((p) => ({ ...p, url: e.target.value }))} />
              <input className={input} placeholder="Văn bản thay thế (alt) — bắt buộc" value={draft.alt} onChange={(e) => setDraft((p) => ({ ...p, alt: e.target.value }))} />
              <input className={input} placeholder="Chú thích ảnh (hiển thị dưới ảnh)" value={draft.caption} onChange={(e) => setDraft((p) => ({ ...p, caption: e.target.value }))} />
              <button type="button" onClick={insertImage} className="h-8 rounded-md bg-brand px-3 text-[12px] font-semibold text-white">
                Chèn ảnh
              </button>
            </>
          ) : null}

          {mode === "video" ? (
            <>
              <input className={input} placeholder="Dán liên kết YouTube" value={draft.url} onChange={(e) => setDraft((p) => ({ ...p, url: e.target.value }))} />
              <button type="button" onClick={insertVideo} className="h-8 rounded-md bg-brand px-3 text-[12px] font-semibold text-white">
                Chèn video
              </button>
            </>
          ) : null}

          {mode === "cta" ? (
            <>
              <input className={input} placeholder="Nhãn nút (VD: Xem tour Đà Lạt)" value={draft.label} onChange={(e) => setDraft((p) => ({ ...p, label: e.target.value }))} />
              <input className={input} placeholder="Liên kết (/tours/… hoặc /dich-vu-khac)" value={draft.href} onChange={(e) => setDraft((p) => ({ ...p, href: e.target.value }))} />
              <button type="button" onClick={insertCta} className="h-8 rounded-md bg-brand px-3 text-[12px] font-semibold text-white">
                Chèn nút CTA
              </button>
            </>
          ) : null}

          {mode === "tour" ? (
            <>
              <select className={input} value={draft.tour} onChange={(e) => setDraft((p) => ({ ...p, tour: e.target.value }))} aria-label="Chọn tour">
                <option value="">Chọn tour…</option>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.title}
                  </option>
                ))}
              </select>
              <button type="button" onClick={insertTour} className="h-8 rounded-md bg-brand px-3 text-[12px] font-semibold text-white">
                Chèn khối tour
              </button>
            </>
          ) : null}

          {mode === "service" ? (
            <>
              <select className={input} value={draft.service} onChange={(e) => setDraft((p) => ({ ...p, service: e.target.value }))} aria-label="Chọn dịch vụ">
                <option value="">Chọn dịch vụ…</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.title}
                  </option>
                ))}
              </select>
              <button type="button" onClick={insertService} className="h-8 rounded-md bg-brand px-3 text-[12px] font-semibold text-white">
                Chèn khối dịch vụ
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        aria-label="Nội dung bài viết"
        className="prose-editor min-h-[380px] max-w-none px-4 py-4 text-[14.5px] leading-[1.8] text-slate-700 outline-none [&_blockquote]:border-l-4 [&_blockquote]:border-brand/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-2"
      style={{ outline: "none" }}
    />
    </div>
  );
}