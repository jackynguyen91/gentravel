import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Star, Trash2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Section, field, ghostButton, labelText } from "@/components/admin/tours/form-parts";

function UploadButton({ onUploaded, label = "Tải ảnh lên" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (event) => {
    const files = [...(event.target.files || [])];
    if (files.length === 0) return;
    setBusy(true);
    try {
      const urls = [];
      for (const file of files) {
        const result = await base44.integrations.Core.UploadPublicFile({ file });
        if (result?.file_url) urls.push(result.file_url);
      }
      onUploaded(urls);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={ghostButton} aria-label={label}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? "Đang tải…" : label}
      </button>
    </>
  );
}

function ImageList({ label, items, onChange, max, hint, reorder, cover, coverValue, onCover }) {
  const rows = items || [];
  const move = (index, delta) => {
    const next = [...rows];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className={labelText}>{label}</label>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">
            {rows.length} ảnh{max ? ` / tối đa ${max}` : ""}
          </span>
          <UploadButton onUploaded={(urls) => onChange(max ? [...rows, ...urls].slice(0, max) : [...rows, ...urls])} />
        </div>
      </div>
      {hint ? <p className="mt-1 text-[11.5px] text-slate-400">{hint}</p> : null}
      <div className="mt-2 space-y-2">
        {rows.map((url, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {url ? <Image src={url} alt="" className="h-full w-full" fittingType="fill" /> : null}
            </div>
            <input
              className={field}
              value={url}
              placeholder="https://…"
              onChange={(e) => onChange(rows.map((item, i) => (i === index ? e.target.value : item)))}
            />
            {reorder ? (
              <div className="flex shrink-0 flex-col gap-0.5">
                <button type="button" aria-label="Đưa lên" onClick={() => move(index, -1)} className="grid h-4 w-7 place-items-center rounded border border-slate-200 text-slate-400 hover:text-brand">
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button type="button" aria-label="Đưa xuống" onClick={() => move(index, 1)} className="grid h-4 w-7 place-items-center rounded border border-slate-200 text-slate-400 hover:text-brand">
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            ) : null}
            {cover ? (
              <button
                type="button"
                aria-label="Chọn làm ảnh đại diện"
                onClick={() => onCover(url)}
                className={`grid h-10 w-8 shrink-0 place-items-center rounded-lg border ${
                  coverValue && coverValue === url ? "border-amber-300 bg-amber-50 text-amber-600" : "border-slate-200 text-slate-400 hover:text-amber-500"
                }`}
              >
                <Star className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Xoá ảnh"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              className="grid h-10 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      {(!max || rows.length < max) && (
        <button type="button" onClick={() => onChange([...rows, ""])} className={`${ghostButton} mt-2`}>
          <Plus className="h-3.5 w-3.5" /> Thêm ô ảnh
        </button>
      )}
    </div>
  );
}

export default function MediaTab({ form, set }) {
  return (
    <div className="space-y-3">
      <Section title="Ảnh đại diện">
        <div className="flex flex-wrap items-start gap-3">
          <div className="h-24 w-36 overflow-hidden rounded-xl bg-slate-100">
            {form.cover_image ? <Image src={form.cover_image} alt="Ảnh đại diện" className="h-full w-full" fittingType="fill" /> : null}
          </div>
          <div className="min-w-[220px] flex-1 space-y-2">
            <input className={field} placeholder="https://…" value={form.cover_image} onChange={(e) => set("cover_image", e.target.value)} />
            <UploadButton label="Tải ảnh đại diện" onUploaded={(urls) => urls[0] && set("cover_image", urls[0])} />
          </div>
        </div>
      </Section>

      <Section title="Thư viện ảnh" hint="Dùng mũi tên để đổi thứ tự, bấm ngôi sao để lấy ảnh làm ảnh đại diện.">
        <ImageList
          label="Ảnh thư viện"
          items={form.gallery_images}
          onChange={(value) => set("gallery_images", value)}
          reorder
          cover
          coverValue={form.cover_image}
          onCover={(url) => url && set("cover_image", url)}
        />
      </Section>

      <Section title="Ảnh điểm đến trong lịch trình">
        <ImageList
          label="Ảnh lịch trình"
          items={form.itinerary_images}
          onChange={(value) => set("itinerary_images", value)}
          reorder
          max={6}
          hint="Tối đa 6 ảnh, hiển thị xen trong phần lịch trình."
        />
      </Section>
    </div>
  );
}