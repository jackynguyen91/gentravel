import { useEffect, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatVND } from "@/lib/format";

const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-ink outline-none transition focus:border-brand";
const labelClass = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500";
const METHODS = ["Chuyển khoản", "Tiền mặt", "VNPay", "MoMo", "Thẻ tín dụng"];

const todayValue = () => new Date().toISOString().slice(0, 10);

export default function BookingReceiveDialog({ open, onOpenChange, remaining, onSubmit, busy }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Chuyển khoản");
  const [paidAt, setPaidAt] = useState(todayValue());
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount(remaining ? String(remaining) : "");
    setMethod("Chuyển khoản");
    setPaidAt(todayValue());
    setNote("");
    setReceipt(null);
    setError("");
  }, [open, remaining]);

  const uploadReceipt = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await base44.integrations.Core.UploadPrivateFile({ file });
      setReceipt({ name: file.name, uri: result.file_uri });
    } catch (uploadError) {
      setError("Không tải được ảnh chứng từ.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Số tiền nhận phải lớn hơn 0.");
      return;
    }
    const ok = await onSubmit({
      amount: value,
      method,
      paid_at: paidAt ? `${paidAt}T12:00:00` : undefined,
      note: note.trim(),
      receipt_file_uri: receipt?.uri || "",
    });
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto sm:rounded-xl">
        <DialogTitle className="text-[15px] font-semibold text-ink">Xác nhận đã nhận tiền</DialogTitle>
        <DialogDescription className="text-[12px] text-slate-500">
          Còn thiếu {formatVND(remaining || 0)}. Có thể ghi nhận nhiều lần: đặt cọc trước, thu phần còn lại sau.
        </DialogDescription>

        <form onSubmit={submit} className="mt-3 space-y-3">
          <div>
            <label className={labelClass} htmlFor="receive-amount">Số tiền nhận (VND)</label>
            <input
              id="receive-amount"
              type="number"
              min="0"
              step="1000"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={`${inputClass} tnum`}
            />
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => setAmount(String(remaining || 0))} className="text-[11px] font-semibold text-brand hover:underline">
                Thu toàn bộ còn lại
              </button>
              <button type="button" onClick={() => setAmount(String(Math.round((remaining || 0) / 2)))} className="text-[11px] font-semibold text-slate-500 hover:underline">
                50% còn lại
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="receive-method">Phương thức</label>
              <select id="receive-method" value={method} onChange={(event) => setMethod(event.target.value)} className={inputClass}>
                {METHODS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="receive-date">Ngày nhận</label>
              <input id="receive-date" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Ảnh chứng từ</label>
            {receipt ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-2.5 py-2">
                <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-slate-600">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{receipt.name}</span>
                </span>
                <button type="button" onClick={() => setReceipt(null)} aria-label="Bỏ ảnh chứng từ" className="text-slate-400 hover:text-rose-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-[12px] font-medium text-slate-500 hover:border-brand hover:text-brand">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                {uploading ? "Đang tải…" : "Tải ảnh chứng từ"}
                <input type="file" accept="image/*" onChange={uploadReceipt} className="hidden" />
              </label>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="receive-note">Ghi chú</label>
            <input id="receive-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: khách chuyển khoản ACB" className={inputClass} />
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => onOpenChange(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[12.5px] font-medium text-slate-600">
              Hủy
            </button>
            <button
              type="submit"
              disabled={busy === "payment" || uploading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {busy === "payment" && <Loader2 className="h-4 w-4 animate-spin" />} Lưu giao dịch
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}