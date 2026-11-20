import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Section, field, ghostButton, labelText } from "@/components/admin/tours/form-parts";
import { bulkCreateTourDepartures, deleteTourDeparture, listTourDepartures, saveTourDeparture, syncTourDeparturesFromBookings, updateTourDeparture } from "@/lib/tour-form-fns";
import { formatVND } from "@/lib/format";

const WEEKDAYS = [
  { value: 1, label: "Thứ hai" },
  { value: 2, label: "Thứ ba" },
  { value: 3, label: "Thứ tư" },
  { value: 4, label: "Thứ năm" },
  { value: 5, label: "Thứ sáu" },
  { value: 6, label: "Thứ bảy" },
  { value: 0, label: "Chủ nhật" },
];

const STATUS_STYLE = {
  "Mở bán": "bg-emerald-50 text-emerald-700",
  "Sắp đầy": "bg-amber-50 text-amber-700",
  "Đã đầy": "bg-red-50 text-red-700",
  Đóng: "bg-slate-100 text-slate-600",
  "Đã khởi hành": "bg-blue-50 text-blue-700",
};

export function formatDDMMYYYY(iso) {
  const text = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const [y, m, d] = text.split("-");
  return `${d}/${m}/${y}`;
}

export default function DeparturesTab({ form, tourId, onCount }) {
  const fetchRows = useServerFn(listTourDepartures);
  const saveRow = useServerFn(saveTourDeparture);
  const updateRow = useServerFn(updateTourDeparture);
  const removeRow = useServerFn(deleteTourDeparture);
  const bulkCreate = useServerFn(bulkCreateTourDepartures);
  const syncFromBookings = useServerFn(syncTourDeparturesFromBookings);

  const defaultSeats = Number(form.max_pax || form.seats_total) || 20;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newDate, setNewDate] = useState("");
  const [seats, setSeats] = useState(defaultSeats);
  const [price, setPrice] = useState("");
  const [rule, setRule] = useState({ weekday: 5, months: 3 });

  const load = useCallback(async () => {
    if (!tourId) return;
    setLoading(true);
    try {
      const result = await fetchRows({ data: { tour_id: tourId, duration_days: Number(form.duration_days) || 1 } });
      setRows(result || []);
      onCount?.((result || []).length);
    } finally {
      setLoading(false);
    }
  }, [fetchRows, tourId, form.duration_days]);

  useEffect(() => {
    if (!tourId) return;
    load();
  }, [tourId]);

  const run = async (key, action, successText) => {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (successText) setMessage(typeof successText === "function" ? successText(result) : successText);
      await load();
    } catch {
      setError("Chưa cập nhật được ngày khởi hành. Vui lòng thử lại.");
    } finally {
      setBusy("");
    }
  };

  if (!tourId) {
    return (
      <Section title="Khởi hành" hint="Tour mới chưa lưu nên chưa gắn được ngày khởi hành.">
        <p className="rounded-lg bg-amber-50 px-3 py-3 text-[12.5px] font-medium text-amber-800">
          Lưu tour trước (bấm “Tạo tour”), sau đó mở lại tab này để thêm ngày khởi hành.
        </p>
      </Section>
    );
  }

  return (
    <div className="space-y-3">
      <Section title="Ngày khởi hành" hint="Tổng chỗ mặc định lấy từ “Số khách tối đa mỗi chuyến”. Chỗ đã đặt tự tính từ đơn chưa hủy; ngày đã có đơn chỉ đóng bán, không xoá.">
        <div className="mb-3 grid gap-2 sm:grid-cols-[150px_110px_150px_1fr]">
          <div>
            <label className={labelText}>Ngày đi</label>
            <input type="date" className={field} value={newDate} onChange={(event) => setNewDate(event.target.value)} />
          </div>
          <div>
            <label className={labelText}>Tổng chỗ</label>
            <input type="number" min={0} className={field} value={seats} onChange={(event) => setSeats(event.target.value)} />
          </div>
          <div>
            <label className={labelText}>Giá riêng của kỳ</label>
            <input type="number" min={0} className={field} placeholder="Để trống = giá chung" value={price} onChange={(event) => setPrice(event.target.value)} />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              disabled={!newDate || busy === "save"}
              onClick={() =>
                run("save", () => saveRow({ data: { tour_id: tourId, tour_title: form.title, departure_date: newDate, seats_total: Number(seats) || 0, price_override: Number(price) || 0, duration_days: Number(form.duration_days) || 1 } }), "Đã thêm ngày khởi hành.")
                  .then(() => {
                    setNewDate("");
                    setPrice("");
                  })
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />} Thêm ngày
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 bg-cloud/60 p-2.5">
          <div>
            <label className={labelText}>Tạo hàng loạt</label>
            <select className={field} value={rule.weekday} onChange={(event) => setRule((prev) => ({ ...prev, weekday: Number(event.target.value) }))}>
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  Mọi {day.label.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelText}>Số tháng tới</label>
            <input type="number" min={1} max={12} className={`${field} w-24`} value={rule.months} onChange={(event) => setRule((prev) => ({ ...prev, months: Number(event.target.value) }))} />
          </div>
          <button
            type="button"
            disabled={busy === "bulk"}
            onClick={() =>
              run(
                "bulk",
                () => bulkCreate({ data: { tour_id: tourId, tour_title: form.title, weekday: rule.weekday, months: rule.months, seats_total: Number(seats) || 0, duration_days: Number(form.duration_days) || 1 } }),
                (result) => `Đã tạo ${result.created} ngày khởi hành.`,
              )
            }
            className={ghostButton}
          >
            {busy === "bulk" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Tạo hàng loạt
          </button>
          <button
            type="button"
            disabled={busy === "sync"}
            onClick={() =>
              run(
                "sync",
                () => syncFromBookings({ data: { tour_id: tourId, tour_title: form.title, seats_total: Number(seats) || 0, duration_days: Number(form.duration_days) || 1 } }),
                (result) => (result.created ? `Đã tạo ${result.created} ngày từ đơn hiện có.` : "Mọi đơn hiện có đã khớp ngày khởi hành."),
              )
            }
            className={ghostButton}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Tạo từ đơn hiện có
          </button>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-[12.5px] text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải ngày khởi hành…
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg bg-cloud px-3 py-3 text-[12.5px] text-slate-500">Chưa có ngày khởi hành nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10.5px] uppercase tracking-[0.06em] text-slate-400">
                  <th className="py-2">Ngày đi</th>
                  <th className="py-2">Ngày về</th>
                  <th className="py-2">Chỗ</th>
                  <th className="py-2">Giá riêng</th>
                  <th className="py-2">Trạng thái</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50">
                    <td className="py-2 font-semibold text-ink tnum">{formatDDMMYYYY(row.departure_date)}</td>
                    <td className="py-2 text-slate-500 tnum">{formatDDMMYYYY(row.return_date)}</td>
                    <td className="py-2 text-slate-600 tnum">
                      {row.seats_booked}/{row.seats_total} · còn {row.remaining}
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        min={0}
                        defaultValue={row.price_override || ""}
                        placeholder="Giá chung"
                        onBlur={(event) => {
                          const value = Number(event.target.value) || 0;
                          if (value === row.price_override) return;
                          run(`price-${row.id}`, () => updateRow({ data: { id: row.id, price_override: value } }));
                        }}
                        className="h-8 w-28 rounded-md border border-slate-200 px-2 text-right tnum"
                      />
                      <span className="ml-1 text-[10px] text-slate-400">{formatVND(form.price_adult)}</span>
                    </td>
                    <td className="py-2">
                      <span className={`rounded-md px-1.5 py-1 text-[10.5px] font-semibold ${STATUS_STYLE[row.status] || "bg-slate-100 text-slate-600"}`}>{row.status}</span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            run(`status-${row.id}`, () =>
                              updateRow({ data: { id: row.id, status: row.raw_status === "Đóng" ? "Mở bán" : "Đóng" } }),
                            )
                          }
                          className="rounded-md border border-slate-200 px-2 py-1 text-[10.5px] font-semibold text-slate-600 hover:border-brand hover:text-brand"
                        >
                          {row.raw_status === "Đóng" ? "Mở bán lại" : "Đóng bán"}
                        </button>
                        <button
                          type="button"
                          disabled={row.has_bookings || busy === `del-${row.id}`}
                          title={row.has_bookings ? "Ngày đã có đơn — chỉ đóng bán" : "Xoá ngày"}
                          onClick={() => run(`del-${row.id}`, () => removeRow({ data: { id: row.id } }), "Đã xoá ngày khởi hành.")}
                          className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-400 hover:text-red-600 disabled:opacity-40"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p> : null}
        {message ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">{message}</p> : null}
      </Section>
    </div>
  );
}