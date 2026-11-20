import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Ticket } from "lucide-react";
import { formatVND } from "@/lib/format";

export default function ServicesPanel({ stats }) {
  if (!stats) return null;
  const total = (stats.revenue || 0) + (stats.tourRevenue || 0);
  const serviceShare = total ? Math.round(((stats.revenue || 0) / total) * 100) : 0;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand">
            <Ticket className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-heading text-[14px] font-bold text-ink">Doanh thu dịch vụ</h2>
            <p className="text-[11.5px] text-slate-500">Vé máy bay, vé tham quan, khách sạn, visa, đưa đón</p>
          </div>
        </div>
        <Link to="/admin/service-requests" className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-1.5 text-[10.5px] font-medium text-slate-500 hover:text-ink">
          Xem yêu cầu <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.06em] text-slate-400">Doanh thu dịch vụ</p>
          <p className="font-heading text-base font-extrabold text-ink tnum">{formatVND(stats.revenue)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.06em] text-slate-400">Tỷ lệ chốt yêu cầu</p>
          <p className="font-heading text-base font-extrabold text-ink tnum">{stats.conversion}%</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Tỷ trọng Tour / Dịch vụ</span>
          <span className="tnum">{100 - serviceShare}% · {serviceShare}%</span>
        </div>
        <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-brand">
          <span className="block h-full bg-cta" style={{ width: `${serviceShare}%` }} />
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Top dịch vụ theo doanh thu</p>
        {stats.top?.length ? (
          <ul className="mt-1.5 space-y-1">
            {stats.top.slice(0, 3).map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="min-w-0 truncate text-slate-600">{row.name}</span>
                <span className="shrink-0 font-semibold text-ink tnum">{formatVND(row.value)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[12px] text-slate-400">Chưa có yêu cầu dịch vụ nào trong kỳ.</p>
        )}
      </div>

      <p className={`mt-3 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium ${stats.pendingOld ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"}`}>
        {stats.pending} yêu cầu chờ xử lý{stats.pendingOld ? ` · ${stats.pendingOld} quá 30 phút` : ""}
      </p>
    </section>
  );
}