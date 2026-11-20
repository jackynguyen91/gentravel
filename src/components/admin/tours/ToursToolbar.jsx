import { Search, SlidersHorizontal } from "lucide-react";
import { TOUR_STATUSES } from "@/lib/tour-status";

const control =
  "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-ink outline-none focus:border-brand";

const SORTS = [
  { key: "newest", label: "Mới tạo trước" },
  { key: "title-asc", label: "Tên A → Z" },
  { key: "price-desc", label: "Giá bán cao → thấp" },
  { key: "price-asc", label: "Giá bán thấp → cao" },
  { key: "orders-desc", label: "Nhiều đơn nhất" },
  { key: "collected-desc", label: "Doanh thu cao nhất" },
  { key: "departure-asc", label: "Khởi hành gần nhất" },
  { key: "fill-asc", label: "Kỳ tới còn nhiều chỗ" },
];

export default function ToursToolbar({ filters, onChange, facets, statusCounts, archivedCount }) {
  const set = (key, value) => onChange({ ...filters, [key]: value, page: 1 });
  const activeFilters = ["category", "scope", "destination", "departure_point", "tag", "featured"].filter(
    (key) => filters[key] && filters[key] !== "all",
  ).length;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-card">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.q}
            onChange={(event) => set("q", event.target.value)}
            placeholder="Tìm tên tour, mã tour, điểm đến…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12.5px] text-ink outline-none focus:border-brand"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ key: "all", label: "Tổng" }, ...TOUR_STATUSES.map((status) => ({ key: status, label: status }))].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => set("status", item.key)}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                filters.status === item.key ? "bg-brand text-white" : "bg-cloud text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label} ({item.key === "all" ? statusCounts.all || 0 : statusCounts[item.key] || 0})
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Lọc
        </span>
        <select className={control} value={filters.category} onChange={(event) => set("category", event.target.value)} aria-label="Danh mục">
          <option value="all">Mọi danh mục</option>
          {facets.categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className={control} value={filters.scope} onChange={(event) => set("scope", event.target.value)} aria-label="Phạm vi">
          <option value="all">Mọi phạm vi</option>
          <option value="domestic">Trong nước</option>
          <option value="international">Quốc tế</option>
        </select>
        <select className={control} value={filters.destination} onChange={(event) => set("destination", event.target.value)} aria-label="Điểm đến">
          <option value="all">Mọi điểm đến</option>
          {facets.destinations.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className={control}
          value={filters.departure_point}
          onChange={(event) => set("departure_point", event.target.value)}
          aria-label="Điểm khởi hành"
        >
          <option value="all">Mọi điểm khởi hành</option>
          {facets.departurePoints.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className={control} value={filters.tag} onChange={(event) => set("tag", event.target.value)} aria-label="Chủ đề">
          <option value="all">Mọi chủ đề</option>
          {facets.tags.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className={control} value={filters.featured} onChange={(event) => set("featured", event.target.value)} aria-label="Nổi bật">
          <option value="all">Nổi bật: tất cả</option>
          <option value="yes">Chỉ tour nổi bật</option>
          <option value="no">Không nổi bật</option>
        </select>
        <select className={control} value={filters.sort} onChange={(event) => set("sort", event.target.value)} aria-label="Sắp xếp">
          {SORTS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => set("archived", filters.archived === "only" ? "no" : "only")}
          className={`h-9 rounded-lg border px-2.5 text-[12px] font-semibold transition ${
            filters.archived === "only"
              ? "border-amber-300 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
          }`}
        >
          {filters.archived === "only" ? `Đang xem lưu trữ (${archivedCount})` : `Lưu trữ (${archivedCount})`}
        </button>
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={() =>
              onChange({ ...filters, category: "all", scope: "all", destination: "all", departure_point: "all", tag: "all", featured: "all", page: 1 })
            }
            className="h-9 rounded-lg px-2 text-[11.5px] font-semibold text-slate-500 hover:text-brand"
          >
            Xoá {activeFilters} lọc
          </button>
        )}
      </div>
    </div>
  );
}