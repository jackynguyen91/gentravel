import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createAdminBooking } from "@/lib/admin-fns";
import { formatDateVN, finalPrice, formatVND } from "@/lib/format";

const EMPTY = {
  tour_id: "",
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  departure_id: "",
  departure_date: "",
  adults_count: 2,
  children_count: 0,
  infants_count: 0,
  channel: "Hotline",
  sale_owner: "",
  voucher_code: "",
  note: "",
};

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const inputClass =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-ink outline-none transition focus:border-brand";

export default function CreateBookingDialog({ open, onOpenChange }) {
  const createBooking = useServerFn(createAdminBooking);
  const router = useRouter();
  const [tours, setTours] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [services, setServices] = useState([]);
  const [addons, setAddons] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setError("");
    setDone(null);
    setAddons([]);
    (async () => {
      const [rows, serviceRows] = await Promise.all([
        base44.entities.Tour.list({ sort: "title", limit: 200 }),
        base44.entities.Service.list({ sort: "title", limit: 200 }),
      ]);
      setTours(asArray(rows));
      setServices(asArray(serviceRows).filter((service) => service.status ? service.status === "Đang hiển thị" : service.is_active !== false));
    })();
  }, [open]);

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  // Chọn kỳ đang mở bán của tour; admin vẫn nhập được ngày khác.
  const onTourChange = async (event) => {
    const tourId = event.target.value;
    setForm((prev) => ({ ...prev, tour_id: tourId, departure_id: "", departure_date: "" }));
    if (!tourId) {
      setDepartures([]);
      return;
    }
    const rows = asArray(await base44.entities.Departure.filter({ tour_id: tourId }, { sort: "departure_date", limit: 200 }));
    const today = new Date().toISOString().slice(0, 10);
    setDepartures(rows.filter((row) => String(row.departure_date || "").slice(0, 10) >= today && !["Đã hủy", "Hoàn tất", "Đóng"].includes(row.status)));
  };

  const pickDeparture = (event) => {
    const departureId = event.target.value;
    const found = departures.find((row) => row.id === departureId);
    setForm((prev) => ({
      ...prev,
      departure_id: departureId,
      departure_date: found ? String(found.departure_date).slice(0, 10) : prev.departure_date,
    }));
  };

  const tour = tours.find((item) => item.id === form.tour_id);
  const addonTotal = addons.reduce((sum, item) => {
    const service = services.find((row) => row.id === item.service_id);
    const price = Number(service?.price) || Number(service?.price_from) || 0;
    return sum + price * Number(item.quantity || 1);
  }, 0);
  const estimate =
    (tour ? finalPrice(tour) * Number(form.adults_count || 0) + Number(tour.price_child || 0) * Number(form.children_count || 0) : 0) +
    addonTotal;

  const addAddon = (serviceId) => {
    if (!serviceId) return;
    setAddons((prev) =>
      prev.some((item) => item.service_id === serviceId)
        ? prev.map((item) => (item.service_id === serviceId ? { ...item, quantity: item.quantity + 1 } : item))
        : [...prev, { service_id: serviceId, quantity: 1 }],
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.tour_id) return setError("Vui lòng chọn tour.");
    if (!form.customer_name.trim()) return setError("Vui lòng nhập tên khách hàng.");
    if (form.customer_phone.trim().length < 8) return setError("Số điện thoại chưa hợp lệ.");
    if (!form.departure_date) return setError("Vui lòng chọn ngày khởi hành.");
    setSaving(true);
    try {
      const result = await createBooking({
        data: {
          ...form,
          adults_count: Number(form.adults_count),
          children_count: Number(form.children_count),
          infants_count: Number(form.infants_count),
          addons: addons.map((item) => ({ service_id: item.service_id, quantity: Number(item.quantity) || 1 })),
        },
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDone(result);
      toast.success(`Đã tạo đơn ${result.booking_code}`);
      router.invalidate();
    } catch (requestError) {
      setError("Không tạo được đơn. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto sm:rounded-xl">
        <DialogTitle className="text-lg font-semibold text-ink">Tạo đơn đặt tour</DialogTitle>
        <DialogDescription className="text-[12.5px] text-slate-500">
          Nhập thông tin khách và tour, hệ thống tự tính giá theo bảng giá hiện hành.
        </DialogDescription>

        {done ? (
          <div className="mt-4 rounded-xl border border-state-success/30 bg-state-success/5 p-5 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-state-success" />
            <p className="mt-2 text-[14px] font-semibold text-ink">Đơn {done.booking_code} đã được tạo</p>
            <p className="mt-1 text-[12.5px] text-slate-500">Tổng tiền {formatVND(done.total_price)}</p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-4 h-9 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white"
            >
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Tour</label>
              <select value={form.tour_id} onChange={onTourChange} className={inputClass}>
                <option value="">Chọn tour…</option>
                {tours.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            {form.tour_id ? (
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Kỳ khởi hành đang mở bán</label>
                <select value={form.departure_id} onChange={pickDeparture} className={inputClass}>
                  <option value="">Ngày khác (admin nhập tay)</option>
                  {departures.map((row) => {
                    const total = Number(row.seats_total) || 0;
                    const booked = Number(row.seats_booked) || 0;
                    const held = Number(row.seats_held) || 0;
                    const left = Math.max(total - booked - held, 0);
                    return (
                      <option key={row.id} value={row.id}>
                        {formatDateVN(String(row.departure_date).slice(0, 10))} · {total > 0 ? `còn ${left}/${total} chỗ` : "chưa đặt chỗ"}
                      </option>
                    );
                  })}
                </select>
                {departures.length === 0 ? (
                  <p className="mt-1 text-[11px] text-amber-700">Tour này chưa có kỳ mở bán — nhập ngày trực tiếp bên dưới.</p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Ngày khởi hành</label>
                <input type="date" value={form.departure_date} onChange={update("departure_date")} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Kênh bán</label>
                <select value={form.channel} onChange={update("channel")} className={inputClass}>
                  {["Website", "Facebook", "Zalo", "Hotline", "Đại lý", "Walk-in", "Trực tiếp"].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Họ tên khách</label>
                <input value={form.customer_name} onChange={update("customer_name")} placeholder="Nguyễn Văn A" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Số điện thoại</label>
                <input value={form.customer_phone} onChange={update("customer_phone")} placeholder="09xx xxx xxx" className={inputClass} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Email khách</label>
              <input value={form.customer_email} onChange={update("customer_email")} placeholder="khach@email.com" className={inputClass} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Người lớn</label>
                <input type="number" min="1" value={form.adults_count} onChange={update("adults_count")} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Trẻ em</label>
                <input type="number" min="0" value={form.children_count} onChange={update("children_count")} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Em bé</label>
                <input type="number" min="0" value={form.infants_count} onChange={update("infants_count")} className={inputClass} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Nhân viên phụ trách</label>
                <input value={form.sale_owner} onChange={update("sale_owner")} placeholder="Tên nhân viên" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Mã voucher / giảm giá</label>
                <input value={form.voucher_code} onChange={update("voucher_code")} placeholder="Không bắt buộc" className={inputClass} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Ghi chú / yêu cầu</label>
              <textarea
                value={form.note}
                onChange={update("note")}
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] outline-none focus:border-brand"
              />
            </div>

            <div className="rounded-lg border border-dashed border-slate-200 p-2.5">
              <label className="mb-1 block text-[11.5px] font-medium text-slate-500">Dịch vụ đi kèm (vé tham quan, khách sạn, đưa đón…)</label>
              <select
                value=""
                onChange={(event) => addAddon(event.target.value)}
                aria-label="Thêm dịch vụ đi kèm"
                className={inputClass}
              >
                <option value="">+ Chọn dịch vụ để bán kèm</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.title} · {formatVND(Number(service.price) || Number(service.price_from) || 0)}
                  </option>
                ))}
              </select>
              {addons.map((item) => {
                const service = services.find((row) => row.id === item.service_id);
                return (
                  <div key={item.service_id} className="mt-1.5 flex items-center gap-2 text-[12px]">
                    <span className="min-w-0 flex-1 truncate text-slate-600">{service?.title}</span>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) =>
                        setAddons((prev) =>
                          prev.map((row) => (row.service_id === item.service_id ? { ...row, quantity: Number(event.target.value) || 1 } : row)),
                        )
                      }
                      aria-label={`Số lượng ${service?.title || ""}`}
                      className="h-7 w-14 rounded-lg border border-slate-200 px-1.5 text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => setAddons((prev) => prev.filter((row) => row.service_id !== item.service_id))}
                      className="text-[11.5px] font-semibold text-red-600"
                    >
                      Bỏ
                    </button>
                  </div>
                );
              })}
              {addonTotal > 0 ? <p className="mt-1 text-[11.5px] text-slate-500">Tiền dịch vụ: {formatVND(addonTotal)}</p> : null}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="text-[12px] text-slate-500">
                {tour ? `Giá từ ${formatVND(finalPrice(tour))} / khách` : "Chọn tour để xem giá"}
              </span>
              <span className="text-[14px] font-semibold text-ink tnum">{formatVND(estimate)}</span>
            </div>

            {error && <p className="rounded-lg bg-state-danger/10 px-3 py-2 text-[12px] font-medium text-state-danger">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-medium text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Tạo đơn
              </button>
            </div>
            <p className="text-[11px] text-slate-400">Đơn tạo hôm nay: {formatDateVN(new Date())}</p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}