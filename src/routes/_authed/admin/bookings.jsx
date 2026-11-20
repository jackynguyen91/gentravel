import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Ban, Download, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  bulkBookingStatus,
  listAdminBookings,
  sendBookingEmails,
  sweepCompletedBookings,
  updateBookingStatus,
} from "@/lib/admin-bookings-fns";
import { exportExcel } from "@/lib/admin/export-excel";
import { PAYMENT_LABEL } from "@/lib/booking-status";
import { formatDateVN, formatVND } from "@/lib/format";
import CreateBookingDialog from "@/components/admin/CreateBookingDialog";
import BookingsToolbar from "@/components/admin/bookings/BookingsToolbar";
import BookingsTable from "@/components/admin/bookings/BookingsTable";
import BookingsKanban from "@/components/admin/bookings/BookingsKanban";
import BookingDrawer from "@/components/admin/bookings/BookingDrawer";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authed/admin/bookings")({
  head: () => ({ meta: [{ title: "Đơn đặt tour · GenTravel Admin" }] }),
  component: AdminBookings,
});

const DEFAULT_FILTERS = {
  status: "all",
  payment: "all",
  tour_id: "all",
  destination: "all",
  channel: "all",
  source_post: "all",
  sale: "all",
  from: "",
  to: "",
  departure_from: "",
  departure_to: "",
  sort: "newest",
};

const PAGE_SIZE = 25;

const EXPORT_COLUMNS = [
  { label: "Mã đơn", value: (row) => row.code },
  { label: "Ngày tạo", value: (row) => formatDateVN(row.booking_date, true) },
  { label: "Khách hàng", value: (row) => row.customer_name },
  { label: "Điện thoại", value: (row) => row.customer_phone },
  { label: "Email", value: (row) => row.customer_email },
  { label: "Tour", value: (row) => row.tour_title },
  { label: "Khởi hành", value: (row) => formatDateVN(row.departure_date) },
  { label: "Người lớn", value: (row) => row.adults },
  { label: "Trẻ em", value: (row) => row.children },
  { label: "Em bé", value: (row) => row.infants },
  { label: "Tổng tiền", value: (row) => row.total },
  { label: "Đã thu", value: (row) => row.paid },
  { label: "Thanh toán", value: (row) => PAYMENT_LABEL[row.payment_status] || row.payment_status },
  { label: "Trạng thái", value: (row) => row.status },
  { label: "Nguồn đặt", value: (row) => row.channel },
  { label: "Bài viết nguồn", value: (row) => row.source_post_title },
  { label: "Nhân viên", value: (row) => row.sale_owner },
];

function AdminBookings() {
  const listBookings = useServerFn(listAdminBookings);
  const setBulkStatus = useServerFn(bulkBookingStatus);
  const sendEmails = useServerFn(sendBookingEmails);
  const sweep = useServerFn(sweepCompletedBookings);
  const changeStatus = useServerFn(updateBookingStatus);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [view, setView] = useState("table");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listBookings({
        data: {
          q: debouncedSearch || undefined,
          status: filters.status === "all" ? undefined : filters.status,
          payment: filters.payment === "all" ? undefined : filters.payment,
          tour_id: filters.tour_id === "all" ? undefined : filters.tour_id,
          destination: filters.destination === "all" ? undefined : filters.destination,
          channel: filters.channel === "all" ? undefined : filters.channel,
          source_post: filters.source_post === "all" ? undefined : filters.source_post,
          sale: filters.sale === "all" ? undefined : filters.sale,
          created_from: filters.from || undefined,
          created_to: filters.to || undefined,
          departure_from: filters.departure_from || undefined,
          departure_to: filters.departure_to || undefined,
          sort: filters.sort,
          page,
          page_size: PAGE_SIZE,
        },
      });
      setData(result);
      setSelected((prev) => prev.filter((id) => result.items.some((item) => item.id === id)));
    } catch (error) {
      toast.error("Không tải được danh sách đơn.");
    } finally {
      setLoading(false);
    }
  }, [listBookings, debouncedSearch, filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Tự chuyển đơn đã đi xong sang "Hoàn tất" (chỉ đơn đã xác nhận và đã thu đủ).
  const sweepOnce = useMemo(() => sweep, [sweep]);
  useEffect(() => {
    let active = true;
    sweepOnce()
      .then((result) => {
        if (active && result?.updated) load();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [sweepOnce]);

  const items = data?.items ?? [];
  const selectedItems = useMemo(() => items.filter((item) => selected.includes(item.id)), [items, selected]);

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const toggleAll = (checked) => setSelected(checked ? items.map((item) => item.id) : []);

  const applyFilter = (patch) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const onSort = (column) =>
    setFilters((prev) => {
      const base = column;
      const map = { customer: "customer", code: "code", tour: "tour", departure: "departure", pax: "pax", total: "total", payment: "payment", status: "status" };
      const key = map[base] || "newest";
      if (prev.sort === `${key}-asc`) return { ...prev, sort: `${key}-desc` };
      if (prev.sort === `${key}-desc`) return { ...prev, sort: key === "departure" ? "departure-asc" : "newest" };
      return { ...prev, sort: `${key}-asc` };
    });

  const runBulkStatus = async (status) => {
    if (!selected.length) return;
    setBusy("status");
    try {
      const result = await setBulkStatus({ data: { ids: selected, status } });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Đã cập nhật ${result.updated} đơn`);
      setSelected([]);
      await load();
    } catch (error) {
      toast.error("Không cập nhật được các đơn đã chọn.");
    } finally {
      setBusy("");
    }
  };

  const runBulkCancel = async () => {
    if (!cancelReason.trim()) return;
    setBusy("status");
    try {
      const result = await setBulkStatus({ data: { ids: selected, status: "Đã hủy", reason: cancelReason } });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Đã hủy ${result.updated} đơn`);
      setCancelOpen(false);
      setCancelReason("");
      setSelected([]);
      await load();
    } catch (error) {
      toast.error("Không hủy được các đơn đã chọn.");
    } finally {
      setBusy("");
    }
  };

  const runBulkEmail = async () => {
    if (!selected.length) return;
    setBusy("email");
    try {
      const result = await sendEmails({ data: { ids: selected.slice(0, 20) } });
      toast.success(`Đã gửi ${result.sent} email${result.skipped ? `, bỏ qua ${result.skipped} đơn thiếu email` : ""}`);
      await load();
    } catch (error) {
      toast.error("Không gửi được email.");
    } finally {
      setBusy("");
    }
  };

  const moveCard = async (id, status, reason) => {
    setBusy("status");
    try {
      const result = await changeStatus({ data: { id, status, reason } });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Đã chuyển sang “${status}”`);
      await load();
    } catch (error) {
      toast.error("Không cập nhật được trạng thái.");
    } finally {
      setBusy("");
    }
  };

  const exportRows = () => {
    const rows = selectedItems.length ? selectedItems : items;
    if (!rows.length) {
      toast.error("Không có đơn nào để xuất.");
      return;
    }
    exportExcel(`don-dat-tour-${Date.now()}`, EXPORT_COLUMNS, rows);
  };

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink">Đơn đặt tour</h1>
          <p className="mt-0.5 text-[12.5px] text-slate-500">
            {data
              ? `${data.total} đơn khớp bộ lọc · ${formatVND(data.totals.value)} giá trị · đã thu ${formatVND(data.totals.collected)} · ${data.totals.paidCount} đơn thanh toán đủ`
              : "Đang tải dữ liệu…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportRows}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
          >
            <Download className="h-4 w-4" /> Xuất Excel
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Tạo đơn
          </button>
        </div>
      </header>

      <BookingsToolbar
        search={search}
        onSearch={setSearch}
        filters={filters}
        onFilter={applyFilter}
        facets={data?.facets}
        view={view}
        onView={setView}
        onRefresh={load}
        loading={loading}
        selected={selected}
        onClearSelection={() => setSelected([])}
        onBulkStatus={runBulkStatus}
        onBulkEmail={runBulkEmail}
        onBulkCancel={() => setCancelOpen(true)}
        onExport={exportRows}
        busy={busy}
        statusCounts={data?.statusCounts}
        paymentCounts={data?.paymentCounts}
      />

      {view === "table" ? (
        <BookingsTable
          items={items}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onOpen={setDetailId}
          sort={filters.sort}
          onSort={onSort}
          loading={loading}
          page={data?.page || page}
          pageSize={data?.pageSize || PAGE_SIZE}
          total={data?.total || 0}
          onPage={(next) => setPage(next)}
        />
      ) : (
        <BookingsKanban items={items} onOpen={setDetailId} loading={loading} onMove={moveCard} busy={busy} />
      )}

      <BookingDrawer bookingId={detailId} onClose={() => setDetailId(null)} onChanged={load} />

      <CreateBookingDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) load();
        }}
      />

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md sm:rounded-xl">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Ban className="h-4 w-4 text-rose-600" /> Hủy {selected.length} đơn đã chọn
          </DialogTitle>
          <DialogDescription className="text-[12px] text-slate-500">
            Lý do được lưu vào lịch sử từng đơn. Thao tác này không xóa dữ liệu đơn.
          </DialogDescription>
          <textarea
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            rows={3}
            placeholder="Lý do hủy (bắt buộc)"
            className="mt-3 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] outline-none focus:border-brand"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setCancelOpen(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[12.5px] font-medium text-slate-600">
              Đóng
            </button>
            <button
              type="button"
              onClick={runBulkCancel}
              disabled={!cancelReason.trim() || busy === "status"}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {busy === "status" && <Loader2 className="h-4 w-4 animate-spin" />} Xác nhận hủy
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}