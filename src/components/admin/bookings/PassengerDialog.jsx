import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { GENDERS, ID_TYPES, PASSENGER_TYPES } from "@/lib/passengers";

const EMPTY = {
  full_name: "",
  passenger_type: "Người lớn",
  gender: "",
  birth_date: "",
  id_type: "CCCD",
  id_number: "",
  id_issue_date: "",
  id_issued_by: "",
  id_expiry_date: "",
  nationality: "Việt Nam",
  phone: "",
  note: "",
};

const field =
  "h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12.5px] text-ink outline-none focus:border-brand";
const label = "text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-400";

export default function PassengerDialog({ open, onOpenChange, passenger, onSubmit, busy }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({ ...EMPTY, ...(passenger || {}) });
  }, [open, passenger]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async () => {
    if (form.full_name.trim().length < 2) {
      setError("Vui lòng nhập họ tên hành khách.");
      return;
    }
    setError("");
    const ok = await onSubmit(form);
    if (!ok) setError("Không lưu được hành khách, vui lòng thử lại.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto sm:rounded-xl">
        <DialogTitle className="text-[15px] font-semibold text-ink">
          {passenger?.id ? "Sửa hành khách" : "Thêm hành khách"}
        </DialogTitle>
        <DialogDescription className="text-[12px] text-slate-500">
          Số CCCD / hộ chiếu được che khi hiển thị, chỉ quản trị viên mở xem đầy đủ và mỗi lần xem đều ghi nhật ký.
        </DialogDescription>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className={label}>Họ và tên *</p>
            <input value={form.full_name} onChange={set("full_name")} placeholder="Nguyễn Văn A" className={`mt-1 ${field}`} />
          </div>
          <div>
            <p className={label}>Loại hành khách</p>
            <select value={form.passenger_type} onChange={set("passenger_type")} className={`mt-1 ${field}`}>
              {PASSENGER_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className={label}>Giới tính</p>
            <select value={form.gender} onChange={set("gender")} className={`mt-1 ${field}`}>
              <option value="">Chưa rõ</option>
              {GENDERS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className={label}>Ngày sinh</p>
            <input type="date" value={form.birth_date} onChange={set("birth_date")} className={`mt-1 ${field}`} />
          </div>
          <div>
            <p className={label}>Quốc tịch</p>
            <input value={form.nationality} onChange={set("nationality")} className={`mt-1 ${field}`} />
          </div>
          <div>
            <p className={label}>Loại giấy tờ</p>
            <select value={form.id_type} onChange={set("id_type")} className={`mt-1 ${field}`}>
              {ID_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className={label}>Số CCCD / hộ chiếu</p>
            <input value={form.id_number} onChange={set("id_number")} placeholder="079123456789" className={`mt-1 ${field} tnum`} />
          </div>
          <div>
            <p className={label}>Ngày cấp</p>
            <input type="date" value={form.id_issue_date} onChange={set("id_issue_date")} className={`mt-1 ${field}`} />
          </div>
          <div>
            <p className={label}>Ngày hết hạn</p>
            <input type="date" value={form.id_expiry_date} onChange={set("id_expiry_date")} className={`mt-1 ${field}`} />
          </div>
          <div className="sm:col-span-2">
            <p className={label}>Nơi cấp</p>
            <input
              value={form.id_issued_by}
              onChange={set("id_issued_by")}
              placeholder="Cục Cảnh sát QLHC về TTXH"
              className={`mt-1 ${field}`}
            />
          </div>
          <div>
            <p className={label}>Điện thoại</p>
            <input value={form.phone} onChange={set("phone")} placeholder="09xx xxx xxx" className={`mt-1 ${field}`} />
          </div>
          <div>
            <p className={label}>Ghi chú</p>
            <input value={form.note} onChange={set("note")} placeholder="Ăn chay, dị ứng…" className={`mt-1 ${field}`} />
          </div>
        </div>

        {error && <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-600">{error}</p>}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-lg border border-slate-200 px-3.5 text-[12.5px] font-medium text-slate-600"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-[12.5px] font-semibold text-white disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Lưu hành khách
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}