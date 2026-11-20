import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Eye, MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Image } from "@/components/ui/image";
import { tourStatusStyle } from "@/lib/tour-status";
import { durationLabel, formatDateVN, formatVND } from "@/lib/format";

const Spark = ({ value }) => <span className="text-[10.5px] text-slate-400 tnum">{value}</span>;

export default function ToursTable({ items, loading, page, pageSize, total, onPage, onEdit, onDuplicate, onArchive, onDelete, onFeatured, busyId }) {
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
      {loading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="grid h-44 place-items-center text-sm text-slate-500">Không có tour nào khớp bộ lọc.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-[13px]">
            <thead className="bg-cloud text-[10.5px] uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Tour</th>
                <th className="px-3 py-3 font-semibold">Danh mục</th>
                <th className="px-3 py-3 font-semibold">Thời lượng</th>
                <th className="px-3 py-3 text-right font-semibold">Giá bán</th>
                <th className="px-3 py-3 text-center font-semibold">Đơn / Khách</th>
                <th className="px-3 py-3 text-right font-semibold">Đã thu</th>
                <th className="px-3 py-3 font-semibold">Kỳ gần nhất</th>
                <th className="px-3 py-3 font-semibold">Trạng thái</th>
                <th className="px-3 py-3 text-center font-semibold">Nổi bật</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((tour) => (
                <tr key={tour.id} className="hover:bg-cloud/60">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {tour.cover_image ? <Image src={tour.cover_image} alt={tour.title} className="h-full w-full" fittingType="fill" /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{tour.title}</p>
                        <p className="truncate text-[11.5px] text-slate-500">
                          {tour.tour_code ? <span className="font-semibold text-brand">{tour.tour_code}</span> : null}
                          {tour.tour_code ? " · " : ""}
                          {tour.destination} · khởi hành {tour.departure_point || "—"}
                        </p>
                        {tour.archived ? (
                          <span className="mt-0.5 inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Đã lưu trữ</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-slate-600">{tour.category}</p>
                    <p className="text-[10.5px] text-slate-400">{tour.scope === "international" ? "Quốc tế" : "Trong nước"}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{durationLabel(tour.duration_days, tour.duration_nights)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <p className="font-semibold text-ink tnum">{formatVND(tour.final_price)}</p>
                    {tour.discount_percent > 0 ? (
                      <p className="text-[10.5px] text-slate-400 tnum">
                        <span className="line-through">{formatVND(tour.original_price || tour.price_adult)}</span> · giảm {tour.discount_percent}%
                      </p>
                    ) : null}
                    <p className="text-[10px] text-slate-400 tnum">TE {formatVND(tour.price_child)} · EB {formatVND(tour.price_infant)}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center">
                    <p className="font-semibold text-ink tnum">{tour.orders}</p>
                    <p className="text-[10.5px] text-slate-400 tnum">{tour.guests} khách</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <p className="font-semibold text-ink tnum">{formatVND(tour.collected)}</p>
                    <Spark value={`/ ${formatVND(tour.value)}`} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {tour.next_departure ? (
                      <>
                        <p className="text-slate-600">{formatDateVN(tour.next_departure)}</p>
                        <p className={`text-[10.5px] tnum ${tour.next_remaining === 0 ? "text-rose-600" : "text-slate-400"}`}>
                          {tour.next_remaining === 0 ? "Hết chỗ" : `Còn ${tour.next_remaining}/${tour.next_total} chỗ`}
                        </p>
                      </>
                    ) : (
                      <span className="text-[11.5px] text-slate-400">Chưa có kỳ mở</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold ${tourStatusStyle(tour.status)}`}>
                      {tour.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => onFeatured(tour)}
                      disabled={busyId === tour.id}
                      aria-label={tour.is_featured ? "Bỏ nổi bật" : "Đặt nổi bật"}
                      aria-pressed={tour.is_featured}
                      className={`relative h-5 w-9 rounded-full transition ${tour.is_featured ? "bg-brand" : "bg-slate-200"} disabled:opacity-50`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${tour.is_featured ? "left-[18px]" : "left-0.5"}`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        to="/tours/$slug"
                        params={{ slug: tour.slug }}
                        aria-label="Xem như khách"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-brand"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => onEdit(tour)}
                        aria-label="Sửa tour"
                        className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-brand"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Thêm thao tác"
                            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:text-brand"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            Thao tác
                          </DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onDuplicate(tour)} className="text-[12.5px]">
                            <Copy className="mr-2 h-3.5 w-3.5" /> Nhân bản tour
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="text-[12.5px]">
                            <Link to="/tours/$slug" params={{ slug: tour.slug }}>
                              <Eye className="mr-2 h-3.5 w-3.5" /> Xem như khách
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onArchive(tour)} className="text-[12.5px]">
                            {tour.archived ? (
                              <>
                                <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Khôi phục khỏi lưu trữ
                              </>
                            ) : (
                              <>
                                <Archive className="mr-2 h-3.5 w-3.5" /> Lưu trữ
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(tour)}
                            disabled={tour.has_bookings}
                            className="text-[12.5px] text-rose-600 focus:text-rose-700"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Xoá hẳn
                            {tour.has_bookings ? <span className="ml-1 text-[10px] text-slate-400">(có đơn)</span> : null}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5">
          <p className="text-[11.5px] text-slate-500 tnum">
            {start}–{end} / {total} tour
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPage(page - 1)}
              disabled={page <= 1}
              aria-label="Trang trước"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-[12px] font-semibold text-ink tnum">
              {page} / {pages}
            </span>
            <button
              type="button"
              onClick={() => onPage(page + 1)}
              disabled={page >= pages}
              aria-label="Trang sau"
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}