import { formatDateVN, formatVND } from "@/lib/format";
import { BOOKING_PAYMENT_STATUS } from "@/lib/payment-utils";

export default function ReceivablesPanel({ rows, loading, onCollect }) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-11 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="grid h-40 place-items-center rounded-2xl border border-slate-100 bg-white text-sm text-slate-500 shadow-card">Không còn khoản phải thu nào.</div>;
  }

  const totalRemaining = rows.reduce((sum, row) => sum + row.remaining, 0);
  const overdueRows = rows.filter((row) => row.overdue);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-[11.5px]">
        <span className="font-semibold text-ink">Phải thu {formatVND(totalRemaining)}</span>
        <span className="text-slate-500">{rows.length} đơn còn nợ</span>
        <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 font-semibold text-red-700">{overdueRows.length} quá hạn</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-[13px]">
          <thead className="bg-cloud text-[11px] uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Đơn / Khách hàng</th>
              <th className="px-3 py-3 font-semibold">Tour</th>
              <th className="px-3 py-3 font-semibold">Khởi hành</th>
              <th className="px-3 py-3 font-semibold">Hạn thanh toán</th>
              <th className="px-3 py-3 text-right font-semibold">Giá trị đơn</th>
              <th className="px-3 py-3 text-right font-semibold">Đã thu</th>
              <th className="px-3 py-3 text-right font-semibold">Còn phải thu</th>
              <th className="px-3 py-3 font-semibold">Trạng thái</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ booking, total, paid, remaining, due_date, overdue, aging, status }) => (
              <tr key={booking.id} className={overdue ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-cloud/60"}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{booking.customer_name}</p>
                  <p className="text-[11.5px] text-slate-500">
                    {booking.booking_code} · {booking.customer_phone}
                  </p>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  <p className="line-clamp-1 max-w-[220px]">{booking.tour_title}</p>
                  <p className="text-[11px] text-slate-400">{booking.channel || "Website"}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateVN(booking.departure_date) || "—"}</td>
                <td className={`whitespace-nowrap px-3 py-3 ${overdue ? "font-semibold text-red-700" : "text-slate-600"}`}>
                  {formatDateVN(due_date) || "—"}
                  <span className="ml-1 text-[10.5px] text-slate-400">({aging} ngày)</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-slate-600 tnum">{formatVND(total)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-slate-600 tnum">{formatVND(paid)}</td>
                <td className={`whitespace-nowrap px-3 py-3 text-right font-bold tnum ${overdue ? "text-red-700" : "text-brand"}`}>{formatVND(remaining)}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold ${BOOKING_PAYMENT_STATUS[status] || BOOKING_PAYMENT_STATUS["Chưa thanh toán"]}`}>
                    {status}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onCollect(booking)}
                    className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-[11.5px] font-semibold text-white"
                  >
                    Thu tiền
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}