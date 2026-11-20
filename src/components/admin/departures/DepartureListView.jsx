import { Link } from "@tanstack/react-router";
import { Eye, Pencil } from "lucide-react";
import { departureStatusStyle } from "@/lib/departure-seats";
import { formatDateVN, formatVND } from "@/lib/format";

const money = (value) => (value ? formatVND(value) : "—");

export default function DepartureListView({ items, loading, onEdit }) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="grid h-44 place-items-center rounded-2xl border border-slate-100 bg-white text-sm text-slate-500 shadow-card">Chưa có kỳ khởi hành nào khớp bộ lọc.</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-[13px]">
          <thead className="bg-cloud text-[10.5px] uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Khởi hành</th>
              <th className="px-3 py-3 font-semibold">Tour</th>
              <th className="px-3 py-3 font-semibold">Chỗ</th>
              <th className="px-3 py-3 text-center font-semibold">Khách</th>
              <th className="px-3 py-3 text-right font-semibold">Đã thu</th>
              <th className="px-3 py-3 text-right font-semibold">Chi phí</th>
              <th className="px-3 py-3 text-right font-semibold">Lợi nhuận</th>
              <th className="px-3 py-3 font-semibold">Trạng thái</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-cloud/60">
                <td className="whitespace-nowrap px-4 py-2.5">
                  <p className="font-semibold text-ink">{formatDateVN(item.departure_date)}</p>
                  <p className="text-[10.5px] text-slate-400">{item.return_date ? `về ${formatDateVN(item.return_date)}` : `${item.days_to_departure} ngày nữa`}</p>
                </td>
                <td className="px-3 py-2.5">
                  <p className="truncate font-medium text-ink">{item.tour_title}</p>
                  <p className="truncate text-[10.5px] text-slate-400">
                    {item.tour_code ? `${item.tour_code} · ` : ""}
                    {item.guide_name ? `HDV ${item.guide_name}` : "Chưa gán HDV"}
                  </p>
                </td>
                <td className="w-36 px-3 py-2.5">
                  <p className="text-[12px] text-slate-600 tnum">
                    {item.booked}/{item.total} · còn {item.remaining}
                  </p>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={`block h-full rounded-full ${item.fill >= 90 ? "bg-red-500" : item.fill >= 50 ? "bg-amber-500" : "bg-brand"}`}
                      style={{ width: `${Math.min(item.fill, 100)}%` }}
                    />
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center tnum">{item.pax}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tnum">
                  <p className="font-semibold text-ink">{money(item.collected)}</p>
                  <p className="text-[10.5px] text-slate-400">/ {money(item.revenue)}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600 tnum">{money(item.cost)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tnum">
                  <p className={`font-semibold ${item.profit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{money(item.profit)}</p>
                  <p className="text-[10.5px] text-slate-400">{item.collected > 0 ? `${item.margin.toFixed(0)}%` : "—"}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold ${departureStatusStyle(item.status)}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      to="/admin/departures/$departureId"
                      params={{ departureId: item.id }}
                      aria-label="Mở kỳ khởi hành"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-brand"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      aria-label="Sửa kỳ"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-brand"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}