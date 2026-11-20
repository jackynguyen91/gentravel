import { Link } from "@tanstack/react-router";
import { Copy, Eye, GripVertical, MoreHorizontal, Pencil, Pin, PinOff, Archive, ExternalLink, Trash2 } from "lucide-react";
import { Image } from "@/components/ui/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { servicePriceLabel, SERVICE_STATUS_STYLE } from "@/lib/service-catalog";
import { formatVND } from "@/lib/format";

export default function ServiceRow({ service, dragHandleProps, onEdit, onToggle, onPin, onDuplicate, onArchive, onDelete }) {
  return (
    <article
      className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-card ${
        service.archived ? "border-dashed border-slate-200 opacity-75" : "border-slate-100"
      }`}
    >
      <span {...(dragHandleProps || {})} className="cursor-grab text-slate-300" aria-label="Kéo để đổi thứ tự">
        <GripVertical className="h-4 w-4" />
      </span>

      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        {service.image ? <Image src={service.image} alt={service.title} className="h-full w-full" fittingType="fill" /> : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand">{service.type}</span>
          <span className={`rounded-full px-2 py-0.5 ${SERVICE_STATUS_STYLE[service.status] || "bg-slate-100 text-slate-500"}`}>
            {service.status}
          </span>
          {service.pinned ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Ghim</span>
          ) : null}
          {service.archived ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">Đã lưu trữ</span>
          ) : null}
          {service.needs_review ? (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-700">Cần rà soát</span>
          ) : null}
        </div>

        <h2 className="mt-1 truncate font-heading text-[15px] font-bold text-ink">{service.title}</h2>
        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-slate-500">
          {servicePriceLabel(service)}
          {service.price_note ? ` · ${service.price_note}` : ""}
        </p>

        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 tnum">
          <div className="flex gap-1">
            <dt>Lượt xem 30 ngày:</dt>
            <dd className="font-semibold text-slate-600">{Number(service.view_count_30d) || 0}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Yêu cầu:</dt>
            <dd className="font-semibold text-slate-600">{service.request_count || 0}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Doanh thu:</dt>
            <dd className="font-semibold text-slate-600">{formatVND(service.revenue || 0)}</dd>
          </div>
          {service.destination ? (
            <div className="flex gap-1">
              <dt>Điểm đến:</dt>
              <dd className="font-semibold text-slate-600">{service.destination}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          role="switch"
          aria-checked={service.status === "Đang hiển thị"}
          aria-label={`Hiển thị ${service.title}`}
          onClick={onToggle}
          className={`relative h-5 w-9 rounded-full transition ${service.status === "Đang hiển thị" ? "bg-brand" : "bg-slate-300"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
              service.status === "Đang hiển thị" ? "left-[18px]" : "left-0.5"
            }`}
          />
        </button>

        <button
          type="button"
          onClick={onPin}
          aria-label={service.pinned ? "Bỏ ghim" : "Ghim lên đầu"}
          title={service.pinned ? "Bỏ ghim" : "Ghim lên đầu"}
          className={`grid h-8 w-8 place-items-center rounded-lg border transition ${
            service.pinned ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:text-brand"
          }`}
        >
          {service.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>

        <Link
          to="/dich-vu-khac"
          search={{ type: service.type }}
          className="hidden h-8 items-center rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-500 hover:text-brand sm:inline-flex"
        >
          Xem
        </Link>

        <button
          type="button"
          onClick={onEdit}
          aria-label="Sửa dịch vụ"
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
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onDuplicate} className="text-[12.5px]">
              <Copy className="mr-2 h-3.5 w-3.5" /> Nhân bản
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-[12.5px]">
              <Link to="/dich-vu-khac" search={{ type: service.type }}>
                <Eye className="mr-2 h-3.5 w-3.5" /> Xem như khách
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-[12.5px]">
              <a href={`/dich-vu-khac?type=${encodeURIComponent(service.type)}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> Mở tab mới
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchive} className="text-[12.5px]">
              <Archive className="mr-2 h-3.5 w-3.5" /> {service.archived ? "Bỏ lưu trữ" : "Lưu trữ"}
            </DropdownMenuItem>
            {service.archived && !service.request_count ? (
              <DropdownMenuItem onClick={onDelete} className="text-[12.5px] text-red-600 focus:text-red-600">
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Xóa hẳn
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}