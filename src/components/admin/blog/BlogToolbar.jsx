import { Search } from "lucide-react";

const field =
  "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-ink outline-none transition focus:border-brand";
const checkbox = "h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-brand";

export default function BlogToolbar({
  statusTabs,
  counts,
  activeStatus,
  onStatus,
  search,
  onSearch,
  categories,
  category,
  onCategory,
  authors,
  author,
  onAuthor,
  destinations,
  destination,
  onDestination,
  sort,
  onSort,
  range,
  onRange,
  selectedCount,
  onClearSelection,
  bulkStatus,
  onBulkStatus,
  canApprove,
}) {
  const statusOptions = canApprove ? ["Nháp", "Chờ duyệt", "Đã lên lịch", "Đã đăng", "Lưu trữ"] : ["Nháp", "Chờ duyệt"];

  return (
    <div className="mt-4 space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {statusTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onStatus(tab)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              activeStatus === tab ? "bg-brand text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-brand"
            }`}
          >
            {tab} <span className={activeStatus === tab ? "text-white/80" : "text-slate-400"}>{counts[tab] || 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white p-2">
        <div className="flex h-9 min-w-[190px] flex-1 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Tìm tiêu đề, tag, điểm đến…"
            className="h-full w-full bg-transparent text-[12.5px] outline-none"
          />
        </div>
        <select value={category} onChange={(event) => onCategory(event.target.value)} className={field} aria-label="Lọc chuyên mục">
          <option value="all">Mọi chuyên mục</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={author} onChange={(event) => onAuthor(event.target.value)} className={field} aria-label="Lọc tác giả">
          <option value="all">Mọi tác giả</option>
          {authors.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={destination} onChange={(event) => onDestination(event.target.value)} className={field} aria-label="Lọc điểm đến">
          <option value="all">Mọi điểm đến</option>
          {destinations.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(event) => onSort(event.target.value)} className={field} aria-label="Sắp xếp">
          <option value="newest">Mới nhất</option>
          <option value="views">Nhiều lượt xem</option>
          <option value="orders">Nhiều đơn phát sinh</option>
        </select>
        <select value={range} onChange={(event) => onRange(event.target.value)} className={field} aria-label="Khoảng ngày">
          <option value="all">Mọi thời gian</option>
          <option value="7d">7 ngày qua</option>
          <option value="30d">30 ngày qua</option>
          <option value="quarter">Quý này</option>
          <option value="year">Năm nay</option>
        </select>
      </div>

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/20 bg-brand-50 px-3 py-2">
          <span className="text-[12.5px] font-semibold text-brand-900">Đã chọn {selectedCount} bài</span>
          <select
            value=""
            onChange={(event) => {
              if (!event.target.value) return;
              onBulkStatus(event.target.value);
            }}
            aria-label="Đổi trạng thái hàng loạt"
            className={field}
          >
            <option value="">Đổi trạng thái…</option>
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button type="button" onClick={onClearSelection} className="text-[12px] font-semibold text-slate-500 underline">
            Bỏ chọn
          </button>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500">
            <span className={`inline-block ${checkbox}`} aria-hidden /> Chọn bằng ô vuông trên thẻ
          </span>
        </div>
      ) : null}
    </div>
  );
}