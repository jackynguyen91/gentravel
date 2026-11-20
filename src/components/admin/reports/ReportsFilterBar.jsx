import { Download, FileSpreadsheet, Loader2, Mail } from "lucide-react";
import { RANGES } from "@/lib/report-analytics";

const select = "h-9 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-600";

export default function ReportsFilterBar({
  filters,
  setFilters,
  tours,
  channels,
  staff,
  onExportCsv,
  onExportPdf,
  onSendEmail,
  sending,
  exporting,
}) {
  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-card xl:flex-row xl:items-center">
      <div className="flex flex-wrap gap-1.5">
        {RANGES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => update("range", item.key)}
            className={`h-9 rounded-lg px-2.5 text-[12px] font-semibold transition ${
              filters.range === item.key ? "bg-brand text-white" : "bg-cloud text-slate-600 hover:text-brand"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 xl:ml-auto">
        <select className={select} value={filters.scope} onChange={(e) => update("scope", e.target.value)} aria-label="Phạm vi">
          <option value="all">Mọi phạm vi</option>
          <option value="domestic">Nội địa</option>
          <option value="international">Quốc tế</option>
        </select>
        <select className={select} value={filters.tourId} onChange={(e) => update("tourId", e.target.value)} aria-label="Tour">
          <option value="all">Mọi tour</option>
          {tours.map((tour) => (
            <option key={tour.id} value={tour.id}>
              {tour.tour_code ? `${tour.tour_code} · ` : ""}
              {tour.title}
            </option>
          ))}
        </select>
        <select className={select} value={filters.channel} onChange={(e) => update("channel", e.target.value)} aria-label="Nguồn đặt">
          <option value="all">Mọi nguồn</option>
          {channels.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className={select} value={filters.staff} onChange={(e) => update("staff", e.target.value)} aria-label="Nhân viên">
          <option value="all">Mọi nhân viên</option>
          {staff.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className={select} value={filters.granularity} onChange={(e) => update("granularity", e.target.value)} aria-label="Kỳ nhóm">
          <option value="month">Theo tháng</option>
          <option value="quarter">Theo quý</option>
          <option value="year">Theo năm</option>
        </select>
        <button type="button" onClick={onExportCsv} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12px] font-semibold text-slate-600 hover:text-brand">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
        </button>
        <button
          type="button"
          onClick={onExportPdf}
          disabled={exporting}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12px] font-semibold text-slate-600 hover:text-brand disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" /> PDF
        </button>
        <button
          type="button"
          onClick={onSendEmail}
          disabled={sending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-2.5 text-[12px] font-semibold text-white disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Gửi báo cáo
        </button>
      </div>
    </div>
  );
}