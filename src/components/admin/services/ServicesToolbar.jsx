import { Search } from "lucide-react";

const FILTER = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-ink outline-none focus:border-brand";

export default function ServicesToolbar({
  types,
  typeCounts,
  activeType,
  onTypeChange,
  search,
  onSearch,
  status,
  onStatus,
  destination,
  onDestination,
  destinations,
  sort,
  onSort,
  statuses,
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Lọc theo loại dịch vụ">
        <button
          type="button"
          role="tab"
          aria-selected={activeType === "all"}
          onClick={() => onTypeChange("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
            activeType === "all" ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
          }`}
        >
          Tất cả <span className={activeType === "all" ? "text-white/80" : "text-slate-400"}>{typeCounts.all || 0}</span>
        </button>
        {types.map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={activeType === type}
            onClick={() => onTypeChange(type)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
              activeType === type
                ? "bg-brand text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
            }`}
          >
            {type} <span className={activeType === type ? "text-white/80" : "text-slate-400"}>{typeCounts[type] || 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[190px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Tìm tên dịch vụ, nhà cung cấp…"
            aria-label="Tìm dịch vụ"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[12.5px] outline-none focus:border-brand"
          />
        </div>
        <select value={status} onChange={(event) => onStatus(event.target.value)} aria-label="Lọc trạng thái" className={FILTER}>
          <option value="all">Mọi trạng thái</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={destination}
          onChange={(event) => onDestination(event.target.value)}
          aria-label="Lọc điểm đến"
          className={FILTER}
        >
          <option value="all">Mọi điểm đến</option>
          {destinations.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(event) => onSort(event.target.value)} aria-label="Sắp xếp" className={FILTER}>
          <option value="manual">Thứ tự hiển thị</option>
          <option value="price_asc">Giá thấp → cao</option>
          <option value="price_desc">Giá cao → thấp</option>
          <option value="newest">Mới nhất</option>
          <option value="requests">Nhiều yêu cầu nhất</option>
        </select>
      </div>
    </div>
  );
}