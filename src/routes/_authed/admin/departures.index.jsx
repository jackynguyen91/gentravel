import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, List, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import DepartureMonthGrid from "@/components/admin/departures/DepartureMonthGrid";
import DepartureDayPanel from "@/components/admin/departures/DepartureDayPanel";
import DepartureEditorDialog from "@/components/admin/departures/DepartureEditorDialog";
import DepartureListView from "@/components/admin/departures/DepartureListView";
import { listAdminDepartures } from "@/lib/admin-departures-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatVND } from "@/lib/format";

export const Route = createFileRoute("/_authed/admin/departures/")({
  component: AdminDepartures,
});

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const control = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-ink outline-none focus:border-brand";

function AdminDepartures() {
  const fetchDepartures = useServerFn(listAdminDepartures);
  const today = new Date();
  const [view, setView] = useState("calendar");
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(today.toISOString().slice(0, 10));
  const [filters, setFilters] = useState({ tour_id: "all", status: "all", q: "" });
  const [data, setData] = useState({ items: [], alerts: [], summary: {}, facets: { tours: [] } });
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchDepartures({ data: { ...filters, month: view === "calendar" ? monthPrefix : undefined } });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [fetchDepartures, filters, monthPrefix, view]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const rows = await base44.entities.Tour.list({ sort: "title", limit: 200 });
      setTours(asArray(rows));
    })();
  }, []);

  const byDate = useMemo(() => {
    const map = {};
    data.items
      .filter((item) => String(item.departure_date).startsWith(monthPrefix))
      .forEach((item) => {
        map[item.departure_date] = [...(map[item.departure_date] || []), item];
      });
    return map;
  }, [data.items, monthPrefix]);

  const dayItems = useMemo(() => byDate[selected] || [], [byDate, selected]);

  useEffect(() => {
    if (loading || view !== "calendar") return;
    const dates = Object.keys(byDate).sort();
    if (dates.length === 0 || byDate[selected]) return;
    setSelected(dates.find((date) => date >= selected) || dates[0]);
  }, [byDate, loading, selected, view]);

  const shiftMonth = (delta) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const openCreate = (date) => {
    setEditing(null);
    setSelected(date);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    if (deleting.orders > 0) {
      toast.error(`Kỳ đã có ${deleting.orders} đơn, không xoá được. Hãy chuyển sang “Đóng” hoặc “Hoàn tất”.`);
      setDeleting(null);
      return;
    }
    await base44.entities.Departure.delete(deleting.id);
    setDeleting(null);
    await load();
    toast.success("Đã xoá kỳ khởi hành");
  };

  const summary = data.summary || {};

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink">Lịch khởi hành & chỗ trống</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {view === "calendar" ? `Tháng ${cursor.month + 1}: ` : "Tất cả kỳ: "}
            {summary.departures || 0} chuyến · {summary.booked || 0}/{summary.seats || 0} chỗ đã bán · lợi nhuận gộp (đã thu − chi phí){" "}
            {formatVND(summary.profit || 0)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold ${view === "calendar" ? "bg-brand text-white" : "text-slate-600"}`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Lịch tháng
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold ${view === "list" ? "bg-brand text-white" : "text-slate-600"}`}
            >
              <List className="h-3.5 w-3.5" /> Danh sách
            </button>
          </div>
          <button
            type="button"
            onClick={() => openCreate(selected)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Thêm chuyến
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-card">
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            placeholder="Tìm tour, mã tour, HDV…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12.5px] text-ink outline-none focus:border-brand"
          />
        </div>
        <select className={control} value={filters.tour_id} onChange={(event) => setFilters((prev) => ({ ...prev, tour_id: event.target.value }))} aria-label="Tour">
          <option value="all">Mọi tour</option>
          {(data.facets?.tours || []).map((tour) => (
            <option key={tour.id} value={tour.id}>
              {tour.code ? `${tour.code} · ` : ""}
              {tour.title}
            </option>
          ))}
        </select>
        <select className={control} value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} aria-label="Trạng thái">
          {["all", "Mở bán", "Sắp đầy", "Đã đầy", "Đóng", "Đã khởi hành", "Hoàn tất", "Đã hủy"].map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "Mọi trạng thái" : status}
            </option>
          ))}
        </select>
        {view === "calendar" && (
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Tháng trước" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-brand">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-[13px] font-semibold text-ink">
              Tháng {cursor.month + 1} / {cursor.year}
            </p>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Tháng sau" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-brand">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {(data.alerts || []).length > 0 && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" /> Cần xử lý ({data.alerts.length})
          </p>
          <ul className="mt-1.5 space-y-1">
            {data.alerts.slice(0, 5).map((alert) => (
              <li key={`${alert.key}-${alert.id}`}>
                <Link
                  to="/admin/departures/$departureId"
                  params={{ departureId: alert.id }}
                  className={`text-[12.5px] hover:underline ${alert.key === "nearFull" ? "text-rose-700" : "text-amber-900"}`}
                >
                  {alert.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "calendar" ? (
        <div className="mt-3 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <DepartureMonthGrid year={cursor.year} month={cursor.month} byDate={byDate} selected={selected} onSelect={setSelected} />
          <div className="space-y-3">
            <DepartureDayPanel
              date={selected}
              items={dayItems}
              onCreate={openCreate}
              onEdit={(item) => {
                setEditing(item);
                setDialogOpen(true);
              }}
              onDelete={setDeleting}
            />
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">Tình hình tháng</p>
              <div className="mt-2 space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Chuyến đã đầy chỗ</span>
                  <span className="font-semibold text-ink tnum">{data.items.filter((item) => item.status === "Đã đầy").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lấp chỗ trung bình</span>
                  <span className="font-semibold text-ink tnum">
                    {summary.seats > 0 ? Math.round((summary.booked / summary.seats) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Đã thu trong tháng</span>
                  <span className="font-semibold text-ink tnum">{formatVND(summary.collected || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Lợi nhuận gộp</span>
                  <span className="font-semibold text-emerald-700 tnum">{formatVND(summary.profit || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <DepartureListView
            items={data.items}
            loading={loading}
            onEdit={(item) => {
              setEditing(item);
              setDialogOpen(true);
            }}
          />
        </div>
      )}

      <DepartureEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        departure={editing}
        date={selected}
        tours={tours}
        onSaved={load}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogTitle className="font-heading text-lg font-extrabold text-ink">Xóa kỳ khởi hành?</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] text-slate-600">
            {deleting?.tour_title} ngày {deleting?.departure_date} sẽ bị xóa khỏi lịch. Đơn đặt tour đã ghi nhận không bị ảnh hưởng.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 rounded-xl border border-slate-200 px-4 text-[13px] font-semibold text-slate-600">Giữ lại</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="h-10 rounded-xl bg-red-600 px-4 text-[13px] font-semibold text-white hover:bg-red-700">
              Xóa kỳ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}