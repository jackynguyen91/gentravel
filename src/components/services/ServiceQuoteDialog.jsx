import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, PhoneCall } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createServiceRequest } from "@/lib/service-request-fns";

const field =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13.5px] text-ink outline-none focus:border-brand";
const label = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";

const EMPTY = { name: "", phone: "", content: "" };

export default function ServiceQuoteDialog({ open, onOpenChange, service }) {
  const create = useServerFn(createServiceRequest);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleOpenChange = (next) => {
    onOpenChange(next);
    if (!next) {
      setForm(EMPTY);
      setError("");
      setCode("");
    }
  };

  const submit = async () => {
    if (form.name.trim().length < 2) return setError("Vui lòng nhập họ tên.");
    if (form.phone.trim().length < 8) return setError("Vui lòng nhập số điện thoại hợp lệ.");
    setSaving(true);
    setError("");
    try {
      const result = await create({
        data: {
          service_id: service?.id,
          service_title: service?.title || "Yêu cầu dịch vụ",
          service_type: service?.type || "",
          customer_name: form.name.trim(),
          customer_phone: form.phone.trim(),
          content: form.content.trim(),
          channel: "Website",
        },
      });
      setCode(result?.request_code || "đã ghi nhận");
    } catch {
      setError("Chưa gửi được yêu cầu. Vui lòng gọi 1900 6789 để được hỗ trợ ngay.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="font-heading text-lg font-extrabold text-ink">Nhận báo giá</DialogTitle>
        <DialogDescription className="text-[12.5px] leading-relaxed text-slate-500">
          {service?.title} — chuyên viên GenTravel gọi lại báo giá trong 30 phút làm việc.
        </DialogDescription>

        {code ? (
          <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-brand" />
            <p className="mt-2 font-heading text-[15px] font-bold text-ink">Đã gửi yêu cầu</p>
            <p className="mt-1 text-[13px] text-slate-600">
              Mã yêu cầu: <strong className="text-ink">{code}</strong>
            </p>
            <p className="mt-1 text-[12.5px] text-slate-500">GenTravel sẽ liên hệ với bạn trong thời gian sớm nhất.</p>
            <a
              href="tel:19006789"
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-brand-100 bg-white px-4 text-[13px] font-semibold text-brand"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              1900 6789
            </a>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              <div>
                <label className={label} htmlFor="quote-name">
                  Họ tên
                </label>
                <input
                  id="quote-name"
                  className={field}
                  value={form.name}
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div>
                <label className={label} htmlFor="quote-phone">
                  Số điện thoại
                </label>
                <input
                  id="quote-phone"
                  className={field}
                  value={form.phone}
                  onChange={(event) => set("phone", event.target.value)}
                  inputMode="tel"
                  placeholder="09xx xxx xxx"
                />
              </div>
              <div>
                <label className={label} htmlFor="quote-content">
                  Nội dung yêu cầu
                </label>
                <textarea
                  id="quote-content"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] leading-relaxed text-ink outline-none focus:border-brand"
                  value={form.content}
                  onChange={(event) => set("content", event.target.value)}
                  placeholder="Số lượng khách, ngày dự kiến, yêu cầu thêm…"
                />
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">{error}</p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="h-10 rounded-xl border border-slate-200 px-4 text-[13px] font-semibold text-slate-600"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-cta px-5 text-[13px] font-semibold text-white transition hover:bg-cta-hover disabled:opacity-70"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Gửi yêu cầu
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}