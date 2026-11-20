import { Link } from "@tanstack/react-router";
import { Eye, FileText, ShoppingBag, Timer } from "lucide-react";

const kpi = "rounded-lg bg-slate-50 px-2.5 py-2";

export default function ContentPanel({ stats }) {
  if (!stats) return null;

  return (
    <section className="rounded-xl border border-slate-100 bg-admin-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-bold text-ink">Nội dung</h2>
          <p className="text-[11px] text-slate-500">Bài viết cẩm nang trong kỳ</p>
        </div>
        <Link to="/admin/blog" className="inline-flex h-7 items-center rounded-md border border-slate-200 px-1.5 text-[10.5px] font-medium text-slate-500 hover:text-ink">
          Quản lý bài
        </Link>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <div className={kpi}>
          <p className="flex items-center gap-1 text-[10.5px] text-slate-500"><FileText className="h-3 w-3" /> Bài đăng trong kỳ</p>
          <p className="mt-0.5 text-[16px] font-extrabold text-ink tnum">{stats.published}</p>
          <p className="text-[10px] text-slate-400">Tổng {stats.total} bài · {stats.pending} chờ duyệt</p>
        </div>
        <div className={kpi}>
          <p className="flex items-center gap-1 text-[10.5px] text-slate-500"><ShoppingBag className="h-3 w-3" /> Đơn từ bài viết</p>
          <p className="mt-0.5 text-[16px] font-extrabold text-ink tnum">{stats.orders}</p>
          <p className="text-[10px] text-slate-400">Tính theo số đơn đã ghi nhận</p>
        </div>
        <div className={kpi}>
          <p className="flex items-center gap-1 text-[10.5px] text-slate-500"><Eye className="h-3 w-3" /> Lượt xem</p>
          <p className="mt-0.5 text-[16px] font-extrabold text-ink tnum">{stats.views}</p>
        </div>
        <div className={kpi}>
          <p className="flex items-center gap-1 text-[10.5px] text-slate-500"><Timer className="h-3 w-3" /> Chờ duyệt</p>
          <p className="mt-0.5 text-[16px] font-extrabold text-ink tnum">{stats.pending}</p>
        </div>
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Top 5 nhiều lượt xem</p>
          <ul className="mt-1 space-y-1">
            {(stats.topViewed || []).map((post) => (
              <li key={post.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="truncate text-slate-600">{post.title}</span>
                <span className="shrink-0 font-semibold text-ink tnum">{post.views}</span>
              </li>
            ))}
            {!stats.topViewed?.length ? <li className="text-[11px] text-slate-400">Chưa có dữ liệu.</li> : null}
          </ul>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Top bài tạo nhiều đơn</p>
          <ul className="mt-1 space-y-1">
            {(stats.topOrders || []).map((post) => (
              <li key={post.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="truncate text-slate-600">{post.title}</span>
                <span className="shrink-0 font-semibold text-ink tnum">{post.orders}</span>
              </li>
            ))}
            {!stats.topOrders?.length ? <li className="text-[11px] text-slate-400">Chưa có dữ liệu.</li> : null}
          </ul>
        </div>
      </div>
    </section>
  );
}