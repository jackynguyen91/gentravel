import { CheckCheck, Download, LayoutGrid, Loader2, Mail, RotateCw, Search, Table2, X, Ban } from "lucide-react";
import { BOOKING_STATUSES, PAYMENT_LABEL } from "@/lib/booking-status";

const selectClass =
  "h-9 max-sm:w-[calc(50%-4px)] rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] font-medium text-slate-600 outline-none transition focus:border-brand";
const dateClass =
  "h-9 max-sm:flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[12.5px] text-slate-600 outline-none focus:border-brand";
const CHANNELS = ["Website", "Facebook", "Zalo", "Hotline", "Đại lý", "Walk-in", "Trực tiếp", "Bài viết"];
const PAYMENT_TABS = [
  { value: "Unpaid", label: PAYMENT_LABEL.Unpaid },
  { value: "Partial", label: "Đã đặt cọc" },
  { value: "Paid", label: "Đã thanh toán" },
  { value: "refund", label: "Đã hoàn tiền" },
];
const SORTS = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "total-desc", label: "Giá trị cao → thấp" },
  { value: "total-asc", label: "Giá trị thấp → cao" },
  { value: "departure-asc", label: "Khởi hành gần nhất" },
  { value: "departure-desc", label: "Khởi hành xa nhất" },
];

const TAB_DEFS = [
  { key: "all", label: "Tất cả" },
  { key: "Chờ xác nhận", label: "Chờ xác nhận", dim: "status" },
  { key: "Đã xác nhận", label: "Đã xác nhận", dim: "status" },
  { key: "Đã thanh toán", label: "Đã thanh toán", dim: "payment" },
  { key: "Đã hủy", label: "Đã hủy", dim: "status" },
];

export default function BookingsToolbar({
  search,
  onSearch,
  filters,
  onFilter,
  facets,
  view,
  onView,
  onRefresh,
  loading,
  selected,
  onClearSelection,
  onBulkStatus,
  onBulkEmail,
  onBulkCancel,
  onExport,
  busy,
  statusCounts,
  paymentCounts,
}) {
  const hasFilters =
    filters.status !== "all" ||
    filters.payment !== "all" ||
    filters.tour_id !== "all" ||
    filters.destination !== "all" ||
    filters.channel !== "all" ||
    filters.source_post !== "all" ||
    filters.sale !== "all" ||
    Boolean(filters.from) ||
    Boolean(filters.to) ||
    Boolean(filters.departure_from) ||
    Boolean(filters.departure_to);

  const resetFilters = () =>
    onFilter({
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
    });

  const countOf = (tab) => {
    if (tab.key === "all") return statusCounts?.all ?? 0;
    if (tab.dim === "payment") return paymentCounts?.Paid ?? 0;
    return statusCounts?.[tab.key] ?? 0;
  };

  const activeTab = (tab) => {
    if (tab.key === "all") return filters.status === "all" && filters.payment === "all";
    if (tab.dim === "payment") return filters.payment === "Paid" && filters.status === "all";
    return filters.status === tab.key && filters.payment === "all";
  };

  const pickTab = (tab) => {
    if (tab.key === "all") return onFilter({ status: "all", payment: "all" });
    if (tab.dim === "payment") return onFilter({ status: "all", payment: "Paid" });
    return onFilter({ status: tab.key, payment: "all" });
  };

  const paymentValue = filters.payment !== "all" ? filters.payment : filters.status === "Hoàn tiền" ? "refund" : "all";

  const pickPayment = (value) => {
    if (value === "all") return onFilter({ payment: "all", status: filters.status === "Hoàn tiền" ? "all" : filters.status });
    if (value === "refund") return onFilter({ payment: "all", status: "Hoàn tiền" });
    return onFilter({ payment: value, status: "all" });
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Tìm mã đơn, tên khách, SĐT, email, tour…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-ink outline-none focus:border-brand"
          />
        </div>
        <select value={filters.sort} onChange={(event) => onFilter({ sort: event.target.value })} className={`${selectClass} h-10`}>
          {SORTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <div className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => onView("table")}
            aria-label="Xem dạng bảng"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold transition ${
              view === "table" ? "bg-brand text-white" : "text-slate-500 hover:text-ink"
            }`}
          >
            <Table2 className="h-4 w-4" /> Bảng
          </button>
          <button
            type="button"
            onClick={() => onView("kanban")}
            aria-label="Xem dạng kanban"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold transition ${
              view === "kanban" ? "bg-brand text-white" : "text-slate-500 hover:text-ink"
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Kanban
          </button>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Tải lại dữ liệu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:text-ink"
        >
          <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mt-2 flex gap-1 overflow-x-auto rounded-xl bg-cloud p-1 no-scrollbar">
        {TAB_DEFS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => pickTab(tab)}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition ${
              activeTab(tab) ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"
            }`}
          >
            {tab.label}
            <span className={`rounded-md px-1 text-[10.5px] tnum ${activeTab(tab) ? "bg-brand-50 text-brand" : "bg-white text-slate-400"}`}>
              {countOf(tab)}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={filters.status} onChange={(event) => onFilter({ status: event.target.value })} className={selectClass}>
          <option value="all">Mọi trạng thái đơn</option>
          {BOOKING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select value={paymentValue} onChange={(event) => pickPayment(event.target.value)} className={selectClass}>
          <option value="all">Mọi thanh toán</option>
          {PAYMENT_TABS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select value={filters.tour_id} onChange={(event) => onFilter({ tour_id: event.target.value })} className={`${selectClass} max-w-[190px]`}>
          <option value="all">Mọi tour</option>
          {facets?.tours?.map((tour) => (
            <option key={tour.id} value={tour.id}>
              {tour.title}
            </option>
          ))}
        </select>
        <select value={filters.destination} onChange={(event) => onFilter({ destination: event.target.value })} className={selectClass}>
          <option value="all">Mọi điểm đến</option>
          {facets?.destinations?.map((destination) => (
            <option key={destination} value={destination}>
              {destination}
            </option>
          ))}
        </select>
        <select value={filters.channel} onChange={(event) => onFilter({ channel: event.target.value })} className={selectClass}>
          <option value="all">Mọi nguồn đặt</option>
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>
        {facets?.posts?.length ? (
          <select
            value={filters.source_post}
            onChange={(event) => onFilter({ source_post: event.target.value })}
            className={`${selectClass} max-w-[190px]`}
          >
            <option value="all">Mọi bài viết</option>
            {facets.posts.map((post) => (
              <option key={post.value} value={post.value}>
                {post.label}
              </option>
            ))}
          </select>
        ) : null}
        <select value={filters.sale} onChange={(event) => onFilter({ sale: event.target.value })} className={selectClass}>
          <option value="all">Mọi nhân viên</option>
          {facets?.sales?.map((sale) => (
            <option key={sale} value={sale}>
              {sale}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400">Khởi hành</span>
          <input type="date" value={filters.departure_from} onChange={(event) => onFilter({ departure_from: event.target.value })} className={dateClass} />
          <span className="text-[12px] text-slate-400">→</span>
          <input type="date" value={filters.departure_to} onChange={(event) => onFilter({ departure_to: event.target.value })} className={dateClass} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400">Ngày tạo</span>
          <input type="date" value={filters.from} onChange={(event) => onFilter({ from: event.target.value })} className={dateClass} />
          <span className="text-[12px] text-slate-400">→</span>
          <input type="date" value={filters.to} onChange={(event) => onFilter({ to: event.target.value })} className={dateClass} />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-slate-500 transition hover:text-ink"
          >
            <X className="h-3.5 w-3.5" /> Xóa lọc
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 px-3 py-2">
          <span className="text-[12.5px] font-semibold text-brand">Đã chọn {selected.length} đơn</span>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => onBulkStatus("Đã xác nhận")}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[12px] font-semibold text-brand shadow-sm transition hover:bg-brand hover:text-white disabled:opacity-60"
          >
            {busy === "status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />} Xác nhận
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={onBulkEmail}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[12px] font-semibold text-brand shadow-sm transition hover:bg-brand hover:text-white disabled:opacity-60"
          >
            {busy === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Gửi email
          </button>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[12px] font-semibold text-brand shadow-sm transition hover:bg-brand hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={onBulkCancel}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[12px] font-semibold text-rose-600 shadow-sm transition hover:bg-rose-600 hover:text-white disabled:opacity-60"
          >
            <Ban className="h-3.5 w-3.5" /> Hủy đơn
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-slate-500 transition hover:text-ink"
          >
            <X className="h-3.5 w-3.5" /> Bỏ chọn
          </button>
        </div>
      )}
    </div>
  );
}