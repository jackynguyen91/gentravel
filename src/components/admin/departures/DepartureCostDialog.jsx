import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { area, field, labelText } from "@/components/admin/tours/form-parts";

const CATEGORIES = ["Khách sạn", "Nhà xe", "Nhà hàng", "Hướng dẫn viên", "Vé tham quan", "Hãng bay", "Đơn vị địa phương", "Khác"];

const empty = () => ({
  partner_id: "",
  category: "Khách sạn",
  amount: 0,
  basis: "Toàn tour",
  quantity: 1,
  status: "Chưa chi",
  paid_at: "",
  note: "",
  receipt_file_uri: "",
});

export default function DepartureCostDialog({ open, onOpenChange, cost, partners, onSubmit, busy }) {
  const [form, setForm] = useState(empty());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(cost ? { ...empty(), ...cost } : empty());
  }, [open, cost]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const uploadReceipt = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadPrivateFile({ file });
      if (result?.file_uri) set("receipt_file_uri", result.file_uri);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (Number(form.amount) <= 0) {
      setError("Vui lòng nhập số tiền chi.");
      return;
    }
    const partner = partners.find((item) => item.id === form.partner_id);
    const ok = await onSubmit({
      ...form,
      amount: Number(form.amount),
      quantity: Number(form.quantity) || 1,
      partner_name: partner?.name || "",
    });
    if (!ok) setError("Không lưu được chi phí.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto sm:rounded-xl">
        <DialogTitle className="text-[15px] font-semibold text-ink">{cost?.id ? "Sửa chi phí kỳ" : "Thêm chi phí kỳ"}</DialogTitle>
        <DialogDescription className="text-[12.5px] text-slate-500">
          Chi phí gắn đúng kỳ khởi hành sẽ được tính vào lợi nhuận của kỳ đó.
        </DialogDescription>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelText}>Nhà cung cấp</label>
            <select className={field} value={form.partner_id} onChange={(e) => set("partner_id", e.target.value)}>
              <option value="">Không chọn</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name} · {partner.type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelText}>Hạng mục</label>
            <select className={field} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelText}>Cách tính</label>
            <select className={field} value={form.basis} onChange={(e) => set("basis", e.target.value)}>
              <option value="Toàn tour">Toàn kỳ</option>
              <option value="Mỗi khách">Mỗi khách</option>
            </select>
          </div>
          <div>
            <label className={labelText}>Số tiền (VND)</label>
            <input type="number" min={0} className={`${field} text-right tnum`} value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>
          <div>
            <label className={labelText}>Số lượng (đêm / suất)</label>
            <input type="number" min={1} className={`${field} text-right tnum`} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </div>
          <div>
            <label className={labelText}>Trạng thái</label>
            <select className={field} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="Chưa chi">Chưa chi</option>
              <option value="Đã chi">Đã chi</option>
            </select>
          </div>
          <div>
            <label className={labelText}>Ngày chi</label>
            <input type="date" className={field} value={form.paid_at || ""} onChange={(e) => set("paid_at", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelText}>Chứng từ</label>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={uploadReceipt} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:border-brand hover:text-brand"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {form.receipt_file_uri ? "Thay chứng từ" : "Tải chứng từ (lưu riêng tư)"}
              </button>
              {form.receipt_file_uri ? (
                <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald-700">
                  <Paperclip className="h-3.5 w-3.5" /> Đã tải lên
                </span>
              ) : null}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelText}>Ghi chú</label>
            <textarea rows={2} className={area} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Số hợp đồng, điều kiện thanh toán…" />
          </div>
        </div>

        {error && <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-600">{error}</p>}

        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[12.5px] font-medium text-slate-600">
            Hủy
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || uploading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-[12.5px] font-semibold text-white disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Lưu chi phí
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}