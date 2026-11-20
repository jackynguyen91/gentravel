import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Image } from "@/components/ui/image";

export default function PostPreview({ form }) {
  const [device, setDevice] = useState("desktop");

  return (
    <div>
      <div className="flex items-center justify-center gap-1 border-b border-slate-100 p-2">
        {[
          ["desktop", Monitor, "Desktop"],
          ["mobile", Smartphone, "Mobile"],
        ].map(([value, Icon, text]) => (
          <button
            key={value}
            type="button"
            onClick={() => setDevice(value)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold ${
              device === value ? "bg-brand text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {text}
          </button>
        ))}
      </div>
      <div className="max-h-[70vh] overflow-y-auto bg-slate-50 p-3">
        <div className={`mx-auto overflow-hidden rounded-xl bg-white shadow-card ${device === "mobile" ? "w-[380px]" : "w-full max-w-3xl"}`}>
          {form.thumbnail ? (
            <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
              <Image src={form.thumbnail} alt={form.thumbnail_alt || form.title} className="h-full w-full" fittingType="fill" />
            </div>
          ) : null}
          <div className="p-5">
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand">{form.category}</span>
            <h1 className="mt-3 font-heading text-2xl font-extrabold leading-tight text-ink">{form.title || "Tiêu đề bài viết"}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{form.summary}</p>
            <div
              className="mt-4 text-[14.5px] leading-[1.8] text-slate-700 [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-brand/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-ink [&_img]:rounded-xl [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:p-2 [&_th]:text-left"
              dangerouslySetInnerHTML={{ __html: form.content_html || "<p><em>Chưa có nội dung.</em></p>" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}