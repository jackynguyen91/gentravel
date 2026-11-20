import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Eye, MousePointerClick, Pencil, Timer, TrendingUp } from "lucide-react";
import { Image } from "@/components/ui/image";
import { STATUS_STYLE } from "@/lib/blog-catalog";
import { formatDateVN } from "@/lib/format";

const stat = "inline-flex items-center gap-1 text-[11px] text-slate-500";

export default function BlogPostCard({ post, selected, onSelect, onArchive, onRestore, canWrite, canEdit }) {
  const status = post.status || "Đã đăng";
  const archived = status === "Lưu trữ" || post.archived;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-card sm:flex-row sm:items-center">
      <div className="flex items-start gap-2.5 sm:items-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(event.target.checked)}
          aria-label={`Chọn bài ${post.title}`}
          className="mt-1 h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand sm:mt-0"
        />
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {post.thumbnail ? <Image src={post.thumbnail} alt={post.thumbnail_alt || post.title} className="h-full w-full" fittingType="fill" /> : null}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand">{post.category || "Chưa phân loại"}</span>
          <span className="font-normal text-slate-400">{formatDateVN(post.published_at || post.created_date)}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_STYLE[status] || STATUS_STYLE["Nháp"]}`}>{status}</span>
          {post.featured ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] text-amber-700">Nổi bật</span> : null}
        </div>
        <h2 className="mt-1 truncate font-heading text-[15px] font-bold text-ink">{post.title}</h2>
        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-slate-500">{post.summary}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={stat}>
            <Eye className="h-3 w-3" /> {post.view_count} lượt xem
          </span>
          <span className={stat}>
            <Timer className="h-3 w-3" /> đọc ~{post.read_minutes} phút
          </span>
          <span className={stat}>
            <MousePointerClick className="h-3 w-3" /> {post.cta_click_count} bấm CTA
          </span>
          <span className={stat}>
            <TrendingUp className="h-3 w-3" /> {post.order_count} đơn
          </span>
          {post.author ? <span className="text-[11px] text-slate-400">· {post.author}</span> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {status === "Đã đăng" ? (
          <Link
            to="/cam-nang/$slug"
            params={{ slug: post.slug }}
            className="hidden h-8 items-center rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-500 hover:text-brand sm:inline-flex"
          >
            Xem
          </Link>
        ) : null}
        {canEdit ? (
          <Link
            to="/admin/blog/$postId"
            params={{ postId: post.id }}
            aria-label="Sửa bài viết"
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-brand"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
        ) : null}
        {canWrite ? (
          archived ? (
            <button
              type="button"
              onClick={onRestore}
              aria-label="Khôi phục bài viết"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-600"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onArchive}
              aria-label="Lưu trữ bài viết"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-600"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )
        ) : null}
      </div>
    </article>
  );
}