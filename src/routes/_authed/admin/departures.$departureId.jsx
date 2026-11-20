import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Loader2, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import DepartureCostDialog from "@/components/admin/departures/DepartureCostDialog";
import DepartureEditorDialog from "@/components/admin/departures/DepartureEditorDialog";
import { deleteDepartureCost, getDepartureDetail, saveDepartureCost } from "@/lib/admin-departures-fns";
import { departureStatusStyle } from "@/lib/departure-seats";
import { exportExcel } from "@/lib/admin/export-excel";
import { formatDateVN, formatVND } from "@/lib/format";

export const Route = createFileRoute("/_authed/admin/departures/$departureId")({
  component: DepartureDetailPage,
});

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const money = (value) => formatVND(value || 0);

function DepartureDetailPage() {
  const { departureId } = Route.useParams();
  const fetchDetail = useServerFn(getDepartureDetail);
  const saveCost = useServerFn(saveDepartureCost);
  const removeCost = useServerFn(deleteDepartureCost);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [tours, setTours] = useState([]);
  const [costOpen, setCostOpen] = useState(false);
  const [editingCost, setEditingCost] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchDetail({ data: { id: departureId } });
      setDetail(result);
    } finally {
      setLoading(false);
    }
  }, [departureId, fetchDetail]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const [partnerRows, tourRows] = await Promise.all([
        base44.entities.Partner.list({ sort: "name", limit: 200 }),
        base44.entities.Tour.list({ sort: "title", limit: 200 }),
      ]);
      setPartners(asArray(partnerRows));
      setTours(asArray(tourRows));
    })();
  }, []);

  const submitCost = async (payload) => {
    setBusy(true);
    try {
      const result = await saveCost({ data: { ...payload, departure_id: departureId, id: editingCost?.id } });
      if (result?.error) {
        toast.error(result.error);
        return false;
      }
      setCostOpen(false);
      setEditingCost(null);
      await load();
      toast.success("Đã lưu chi phí");
      return true;
    } catch (error) {
      toast.error("Không lưu được chi phí.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const removeCostLine = async (cost) => {
    if (!window.confirm(`Xoá chi phí ${cost.category} ${money(cost.line_total)}?`)) return;
    await removeCost({ data: { id: cost.id } });
    await load();
    toast.success("Đã xoá chi phí");
  };

  const exportGuests = () => {
    if (!detail) return;
    exportExcel(
      `khach-${detail.departure.tour_code || "tour"}-${detail.departure.departure_date}`,
      [
        { label: "Mã đơn", value: (row) => row.code },
        { label: "Họ tên", value: (row) => row.customer_name },
        { label: "Điện thoại", value: (row) => row.customer_phone },
        { label: "NL", value: (row) => row.adults },
        { label: "TE", value: (row) => row.children },
        { label: "EB", value: (row) => row.infants },
        { label: "Trạng thái đơn", value: (row) => row.status },
        { label: "Đã thu", value: (row) => row.paid },
        { label: "Ghi chú", value: (row) => row.note },
      ],
      detail.guests,
    );
  };

  if (loading) {
    return (
      <div className="grid h-64 place-items-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-card">
        <p className="text-[14px] font-semibold text-ink">Không tìm thấy kỳ khởi hành.</p>
        <Link to="/admin/departures" className="mt-3 inline-flex h-9 items-center rounded-lg bg-brand px-4 text-[13px] font-semibold text-white">
          Về lịch khởi hành
        </Link>
      </div>
    );
  }

  const { departure, finance, guests, costs } = detail;

  return (
    <div>
      <Link to="/admin/departures" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-slate-500 hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" /> Lịch khởi hành
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink">{departure.tour_title}</h1>
            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${departureStatusStyle(departure.status)}`}>{departure.status}</span>
          </div>
          <p className="mt-1 text-[13px] text-slate-500">
            {departure.tour_code ? `${departure.tour_code} · ` : ""}
            Khởi hành {formatDateVN(departure.departure_date)}
            {departure.return_date ? ` · về ${formatDateVN(departure.return_date)}` : ""}
            {departure.guide_name ? ` · HDV ${departure.guide_name}` : ""}
            {departure.vehicle ? ` · ${departure.vehicle}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportGuests}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-600 hover:border-brand hover:text-brand"
          >
            <Download className="h-4 w-4" /> Excel cho HDV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-600 hover:border-brand hover:text-brand"
          >
            <Printer className="h-4 w-4" /> In / PDF
          </button>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white"
          >
            <Pencil className="h-4 w-4" /> Sửa kỳ
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-card">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">Chỗ đã bán</p>
          <p className="mt-1 text-[17px] font-extrabold text-ink tnum">
            {finance.booked}/{finance.total}
          </p>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
            <span
              className={`block h-full rounded-full ${finance.fill >= 90 ? "bg-red-500" : finance.fill >= 50 ? "bg-amber-500" : "bg-brand"}`}
              style={{ width: `${Math.min(finance.fill, 100)}%` }}
            />
          </span>
          <p className="mt-1 text-[10.5px] text-slate-400 tnum">
            {finance.fill}% · còn {finance.remaining} chỗ · giữ {finance.held}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-card">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">Doanh thu đã thu</p>
          <p className="mt-1 text-[17px] font-extrabold text-emerald-700 tnum">{money(finance.collected)}</p>
          <p className="text-[10.5px] text-slate-400 tnum">tổng giá trị đơn {money(finance.revenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-card">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">Chi phí kỳ</p>
          <p className="mt-1 text-[17px] font-extrabold text-ink tnum">{money(finance.cost)}</p>
          <p className="text-[10.5px] text-slate-400 tnum">
            riêng kỳ {money(finance.direct_cost)} · phân bổ {money(finance.allocated_cost)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-card">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">Lợi nhuận gộp</p>
          <p className={`mt-1 text-[17px] font-extrabold tnum ${finance.profit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{money(finance.profit)}</p>
          <p className="text-[10.5px] text-slate-400 tnum">
            biên {finance.margin.toFixed(1)}% · {finance.pax} khách · {finance.orders} đơn
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-slate-500">Khách đã đặt ({guests.length})</p>
        </div>
        {guests.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-slate-500">Chưa có khách cho kỳ này.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[12.5px]">
              <thead className="bg-cloud text-[10.5px] uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Mã đơn</th>
                  <th className="px-3 py-2 font-semibold">Khách</th>
                  <th className="px-3 py-2 text-center font-semibold">NL / TE / EB</th>
                  <th className="px-3 py-2 font-semibold">Trạng thái</th>
                  <th className="px-3 py-2 text-right font-semibold">Đã thu</th>
                  <th className="px-3 py-2 text-right font-semibold">Giá trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td className="px-4 py-2 font-semibold text-brand">{guest.code}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink">{guest.customer_name}</p>
                      <p className="text-[10.5px] text-slate-400">{guest.customer_phone}</p>
                    </td>
                    <td className="px-3 py-2 text-center tnum">
                      {guest.adults} / {guest.children} / {guest.infants}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {guest.status}
                      {["Đã hủy", "Hoàn tiền"].includes(guest.status) ? <span className="ml-1 text-[10px] text-rose-500">(không tính chỗ)</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700 tnum">{money(guest.paid)}</td>
                    <td className="px-3 py-2 text-right text-slate-600 tnum">{money(guest.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-slate-500">Chi phí của kỳ ({costs.length})</p>
            <p className="text-[11px] text-slate-400">Chi phí chung của tour được phân bổ theo tỷ lệ khách của kỳ ({money(finance.allocated_cost)}).</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingCost(null);
              setCostOpen(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[12px] font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Thêm chi phí
          </button>
        </div>
        {costs.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-slate-500">Chưa ghi nhận chi phí riêng cho kỳ này.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {costs.map((cost) => (
              <li key={cost.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-ink">
                    {cost.category}
                    {cost.partner_name ? <span className="text-slate-400"> · {cost.partner_name}</span> : null}
                  </p>
                  <p className="text-[10.5px] text-slate-400">
                    {cost.basis} · {cost.quantity} · {cost.status}
                    {cost.paid_at ? ` · ${formatDateVN(cost.paid_at)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-[12.5px] font-semibold text-ink tnum">{money(cost.line_total)}</span>
                  <button
                    type="button"
                    aria-label="Sửa chi phí"
                    onClick={() => {
                      setEditingCost(cost);
                      setCostOpen(true);
                    }}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-brand"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Xoá chi phí"
                    onClick={() => removeCostLine(cost)}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:border-rose-200 hover:text-rose-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DepartureCostDialog
        open={costOpen}
        onOpenChange={(open) => {
          setCostOpen(open);
          if (!open) setEditingCost(null);
        }}
        cost={editingCost}
        partners={partners}
        onSubmit={submitCost}
        busy={busy}
      />

      <DepartureEditorDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        departure={departure}
        date={departure.departure_date}
        tours={tours}
        onSaved={load}
      />
    </div>
  );
}