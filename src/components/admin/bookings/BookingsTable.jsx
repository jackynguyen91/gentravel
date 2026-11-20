import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { PAYMENT_LABEL, PAYMENT_STYLE, statusStyle } from "@/lib/booking-status";
import { formatDateVN, formatVND } from "@/lib/format";

function SortHead({ label, column, sort, onSort, className = "" }) {
  const active = sort?.startsWith(column);
  const ascending = sort === `${column}-asc`;
  return (
    <th className={`px-3 py-3 font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.08em] transition hover:text-ink ${active ? "text-ink" : ""}`}
      >
        {label}
        {active ? ascending ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
      </button>
    </th>
  );
}

function DepartureBadge({ days }) {
  if (days === null || days === undefined) return null;
  if (days < 0) return <span className="mt-0.5 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Đã khởi hành</span>;
  const tone = days <= 7 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500";
  return <span className={`mt-0.5 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}>Còn {days} ngày</span>;
}

export default function BookingsTable({
  items,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
  sort,
  onSort,
  loading,
  page,
  pageSize,
  total,
  onPage,
}) {
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));
  const pages = Math.max(Math.ceil((total || 0) / (pageSize || 25)), 1);
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total || 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-[13px]">
          <thead className="bg-cloud text-[11px] uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="w-9 px-2 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => onToggleAll(event.target.checked)}
                  aria-label="Chọn tất cả"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand"
                />
              </th>
              <SortHead label="Mã đơn" column="code" sort={sort} onSort={onSort} />
              <SortHead label="Khách hàng" column="customer" sort={sort} onSort={onSort} />
              <SortHead label="Tour" column="tour" sort={sort} onSort={onSort} />
              <SortHead label="Khởi hành" column="departure" sort={sort} onSort={onSort} />
              <SortHead label="Khách" column="pax" sort={sort} onSort={onSort} />
              <SortHead label="Tổng tiền" column="total" sort={sort} onSort={onSort} />
              <SortHead label="Thanh toán" column="payment" sort={sort} onSort={onSort} />
              <SortHead label="Trạng thái" column="status" sort={sort} onSort={onSort} />
              <th className="px-3 py-3 font-semibold">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`skeleton-${index}`}>
                  <td colSpan={10} className="px-3 py-3">
                    <div className="h-6 animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-16 text-center text-[13px] text-slate-500">
                  Không có đơn nào khớp bộ lọc hiện tại.
                </td>
              </tr>
            )}

            {!loading &&
              items.map((booking) => {
                const overdue =
                  booking.days_to_departure !== null &&
                  booking.days_to_departure >= 0 &&
                  booking.days_to_departure <= 3 &&
                  (booking.status !== "Đã xác nhận" || booking.payment_status !== "Paid");
                return (
                  <tr key={booking.id} className="align-middle transition hover:bg-cloud/60">
                    <td className="px-2 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.includes(booking.id)}
                        onChange={() => onToggle(booking.id)}
                        aria-label={`Chọn đơn ${booking.code}`}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => onOpen(booking.id)}
                        className="font-heading text-[12.5px] font-bold text-brand hover:underline"
                      >
                        {booking.code}
                      </button>
                      <p className="text-[10.5px] text-slate-400">{formatDateVN(booking.booking_date)}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="truncate font-semibold text-ink">{booking.customer_name}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {booking.customer_phone} · {booking.channel}
                      </p>
                    </td>
                    <td className="max-w-[180px] px-3 py-2.5">
                      <p className="truncate text-[12px] text-slate-700" title={booking.tour_title}>
                        {booking.tour_title}
                      </p>
                      <p className="truncate text-[10.5px] text-slate-400">
                        {formatDateVN(booking.booking_date, true)}
                        {booking.sale_owner ? ` · ${booking.sale_owner}` : ""}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-slate-600">
                      <span className={overdue ? "font-semibold text-rose-600" : ""}>{formatDateVN(booking.departure_date)}</span>
                      <span className={`block rounded-md px-1 py-0.5 text-[10px] font-semibold ${overdue ? "text-rose-600" : ""}`}>
                        <DepartureBadge days={booking.days_to_departure} />
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[11.5px] text-slate-600 tnum">
                      {booking.adults} NL
                      {booking.children > 0 ? ` · ${booking.children} TE` : ""}
                      {booking.infants > 0 ? ` · ${booking.infants} EB` : ""}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-ink tnum">{formatVND(booking.total)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold ${PAYMENT_STYLE[booking.payment_status] || PAYMENT_STYLE.Unpaid}`}
                      >
                        {PAYMENT_LABEL[booking.payment_status] || PAYMENT_LABEL.Unpaid}
                      </span>
                      <span className="block text-[10px] text-slate-400 tnum">Đã thu {formatVND(booking.paid)}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold ${statusStyle(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => onOpen(booking.id)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11.5px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
                      >
                        Mở
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
        <p className="text-[11.5px] text-slate-500 tnum">
          {total ? `${from}–${to} / ${total} đơn` : "0 đơn"}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPage(Math.max(page - 1, 1))}
            disabled={page <= 1}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11.5px] font-semibold text-slate-600 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Trước
          </button>
          <span className="px-1 text-[11.5px] text-slate-500 tnum">
            Trang {page}/{pages}
          </span>
          <button
            type="button"
            onClick={() => onPage(Math.min(page + 1, pages))}
            disabled={page >= pages}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11.5px] font-semibold text-slate-600 disabled:opacity-40"
          >
            Sau <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}