import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import RequireCapability from "@/components/admin/RequireCapability";
import ReportsFilterBar from "@/components/admin/reports/ReportsFilterBar";
import ReportTable from "@/components/admin/reports/ReportTable";
import ReportBarChart from "@/components/admin/reports/ReportBarChart";
import { buildAnalytics } from "@/lib/report-analytics";
import { exportCsv, exportPdf } from "@/lib/report-export";
import { sendReportEmail } from "@/lib/report-fns";
import { loadSettings } from "@/lib/settings";
import { stripSample } from "@/lib/demo";
import { formatDateVN, formatVND } from "@/lib/format";

export const Route = createFileRoute("/_authed/admin/reports")({
  component: AdminReports,
});

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));

const TABS = [
  { key: "revenue", label: "Doanh thu & đơn" },
  { key: "tours", label: "Tour & kỳ khởi hành" },
  { key: "channels", label: "Nguồn & nhân viên" },
  { key: "cancel", label: "Hủy & hoàn tiền" },
  { key: "fill", label: "Lấp đầy chỗ" },
  { key: "customers", label: "Khách hàng" },
  { key: "aging", label: "Tuổi nợ" },
];

function AdminReports() {
  const { user } = useAuth();
  const mail = useServerFn(sendReportEmail);
  const [bookings, setBookings] = useState([]);
  const [tours, setTours] = useState([]);
  const [costs, setCosts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("revenue");
  const [sending, setSending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ range: "90d", scope: "all", tourId: "all", channel: "all", staff: "all", granularity: "month" });

  useEffect(() => {
    (async () => {
      const [{ settings: cfg }, bookingRows, tourRows, costRows, paymentRows, departureRows] = await Promise.all([
        loadSettings(),
        base44.entities.Booking.list({ sort: "-booking_date", limit: 1000 }),
        base44.entities.Tour.list({ limit: 300 }),
        base44.entities.TourCost.list({ limit: 500 }),
        base44.entities.Payment.list({ limit: 1000 }),
        base44.entities.Departure.list({ limit: 900 }),
      ]);
      setSettings(cfg);
      setBookings(stripSample(asArray(bookingRows), cfg));
      setTours(asArray(tourRows));
      setCosts(stripSample(asArray(costRows), cfg));
      setPayments(stripSample(asArray(paymentRows), cfg));
      setDepartures(asArray(departureRows));
      setLoading(false);
    })();
  }, []);

  const data = useMemo(
    () => buildAnalytics({ bookings, tours, costs, payments, departures, filters: { ...filters, dueDays: settings?.payment_due_days ?? 7 } }),
    [bookings, tours, costs, payments, departures, filters, settings],
  );

  const periodLabel = `${formatDateVN(data.from)} – ${formatDateVN(data.to)}`;
  const channels = useMemo(() => [...new Set(bookings.map((row) => row.channel).filter(Boolean))], [bookings]);
  const staff = useMemo(() => [...new Set(bookings.map((row) => row.sale_owner).filter(Boolean))], [bookings]);

  const exportSpec = () => {
    if (tab === "revenue") {
      return {
        filename: "bao-cao-doanh-thu",
        title: "Doanh thu & số đơn theo kỳ",
        columns: [
          { key: "key", label: "Kỳ" },
          { key: "revenue", label: "Doanh thu", format: "money" },
          { key: "orders", label: "Số đơn" },
          { key: "prevRevenue", label: "Cùng kỳ năm trước", format: "money" },
        ],
        rows: data.series,
        summary: [
          { label: "Doanh thu đã thanh toán", value: formatVND(data.totals.revenue) },
          { label: "Số đơn", value: data.totals.orders },
        ],
      };
    }
    if (tab === "tours") {
      return {
        filename: "bao-cao-theo-tour",
        title: "Doanh thu, khách và lợi nhuận theo tour",
        columns: [
          { key: "name", label: "Tour" },
          { key: "orders", label: "Đơn" },
          { key: "guests", label: "Khách" },
          { key: "revenue", label: "Doanh thu", format: "money" },
          { key: "cost", label: "Chi phí", format: "money" },
          { key: "profit", label: "Lợi nhuận gộp", format: "money" },
          { key: "margin", label: "Biên", format: "percent" },
        ],
        rows: data.byTour,
        summary: [
          { label: "Doanh thu", value: formatVND(data.totals.revenue) },
          { label: "Lợi nhuận gộp", value: formatVND(data.totals.profit) },
        ],
      };
    }
    if (tab === "channels") {
      return {
        filename: "bao-cao-nguon-nhan-vien",
        title: "Hiệu suất theo nguồn đặt và nhân viên",
        columns: [
          { key: "name", label: "Nguồn / Nhân viên" },
          { key: "orders", label: "Đơn" },
          { key: "revenue", label: "Doanh thu", format: "money" },
          { key: "cancelRate", label: "Tỷ lệ hủy", format: "percent" },
        ],
        rows: [...data.byChannel, ...data.byStaff],
      };
    }
    if (tab === "cancel") {
      return {
        filename: "bao-cao-huy-hoan",
        title: "Tỷ lệ hủy & hoàn tiền",
        columns: [
          { key: "reason", label: "Lý do hủy" },
          { key: "count", label: "Số đơn" },
        ],
        rows: data.cancelReasons,
        summary: [
          { label: "Tỷ lệ hủy", value: `${data.totals.cancelRate.toFixed(1)}%` },
          { label: "Đã hoàn tiền", value: formatVND(data.totals.refunds) },
        ],
      };
    }
    if (tab === "fill") {
      return {
        filename: "bao-cao-lap-day",
        title: "Tỷ lệ lấp đầy chỗ",
        columns: [
          { key: "month", label: "Tháng" },
          { key: "departures", label: "Số kỳ" },
          { key: "seats", label: "Tổng chỗ" },
          { key: "booked", label: "Đã bán" },
          { key: "rate", label: "Lấp đầy", format: "percent" },
        ],
        rows: data.fillRate,
      };
    }
    if (tab === "customers") {
      return {
        filename: "bao-cao-khach-hang",
        title: "Top khách hàng chi tiêu",
        columns: [
          { key: "name", label: "Khách hàng" },
          { key: "phone", label: "Điện thoại" },
          { key: "orders", label: "Số đơn" },
          { key: "spent", label: "Chi tiêu", format: "money" },
        ],
        rows: data.customers.topCustomers,
        summary: [
          { label: "Khách mới", value: data.customers.newCustomers },
          { label: "Khách quay lại", value: data.customers.returning },
        ],
      };
    }
    return {
      filename: "bao-cao-tuoi-no",
      title: "Công nợ theo tuổi nợ",
      columns: [{ key: "bucket", label: "Tuổi nợ" }, { key: "receivable", label: "Phải thu", format: "money" }, { key: "payable", label: "Phải trả", format: "money" }],
      rows: Object.keys(data.aging.receivableBuckets).map((bucket) => ({ bucket, receivable: data.aging.receivableBuckets[bucket], payable: data.aging.payableBuckets[bucket] })),
    };
  };

  const handleCsv = () => {
    const spec = exportSpec();
    exportCsv(
      `${spec.filename}-${data.from}-${data.to}.csv`,
      spec.columns.map((col) => col.label),
      spec.rows.map((row) => spec.columns.map((col) => row[col.key])),
    );
  };

  const handlePdf = async () => {
    const spec = exportSpec();
    setExporting(true);
    try {
      await exportPdf({
        filename: `${spec.filename}-${data.from}.pdf`,
        title: spec.title,
        subtitle: periodLabel,
        columns: spec.columns.map((col) => col.label),
        rows: spec.rows.map((row) =>
          spec.columns.map((col) => (col.format === "money" ? formatVND(row[col.key]) : col.format === "percent" ? `${(Number(row[col.key]) || 0).toFixed(1)}%` : row[col.key])),
        ),
        summary: spec.summary || [
          { label: "Doanh thu", value: formatVND(data.totals.revenue) },
          { label: "Số đơn", value: data.totals.orders },
        ],
      });
    } finally {
      setExporting(false);
    }
  };

  const handleEmail = async () => {
    setSending(true);
    try {
      const result = await mail();
      if (result?.error) toast.error(result.error);
      else toast.success(`Đã gửi báo cáo tới ${result.recipients} email`);
    } catch {
      toast.error("Không có quyền gửi báo cáo.");
    } finally {
      setSending(false);
    }
  };

  const kpis = [
    { label: "Doanh thu đã thanh toán", value: formatVND(data.totals.revenue), hint: `Đã trừ hoàn ${formatVND(data.totals.refunds)}` },
    { label: "Số đơn", value: String(data.totals.orders), hint: `${data.totals.cancelled} đơn hủy` },
    { label: "Số khách", value: String(data.totals.guests), hint: `Tỷ lệ hủy ${data.totals.cancelRate.toFixed(1)}%` },
    { label: "Lợi nhuận gộp", value: formatVND(data.totals.profit), hint: `Chi phí ${formatVND(data.totals.cost)}` },
    { label: "Công nợ phải thu", value: formatVND(data.totals.receivable), hint: "Theo hạn thanh toán trong Cài đặt" },
    { label: "Công nợ phải trả", value: formatVND(data.totals.payable), hint: "Chi phí chưa chi cho đối tác" },
  ];

  return (
    <RequireCapability user={user} capability="reports">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink">Báo cáo & phân tích</h1>
            <p className="mt-1 text-[13px] text-slate-500">Kỳ báo cáo {periodLabel} · số liệu từ đơn, sổ thanh toán và chi phí thật</p>
          </div>
        </div>

        <ReportsFilterBar
          filters={filters}
          setFilters={setFilters}
          tours={tours.filter((tour) => !tour.archived)}
          channels={channels}
          staff={staff}
          onExportCsv={handleCsv}
          onExportPdf={handlePdf}
          onSendEmail={handleEmail}
          sending={sending}
          exporting={exporting}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {kpis.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-card">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
              <p className="mt-1 text-[16px] font-bold text-ink tnum">{loading ? "…" : item.value}</p>
              <p className="text-[10.5px] text-slate-400">{item.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-white p-1.5 shadow-card">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`h-9 rounded-lg px-3 text-[12px] font-semibold transition ${tab === item.key ? "bg-brand text-white" : "text-slate-600 hover:bg-cloud"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "revenue" ? (
          <div className="mt-3 grid gap-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <h3 className="text-[13px] font-bold text-ink">Doanh thu theo {filters.granularity === "month" ? "tháng" : filters.granularity === "quarter" ? "quý" : "năm"}</h3>
              <ReportBarChart data={data.series.map((row) => ({ ...row, name: row.key }))} valueKey="revenue" label="Doanh thu" color="#0F766E" height={230} />
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
              <ReportTable
                columns={[
                  { key: "key", label: "Kỳ" },
                  { key: "revenue", label: "Doanh thu", format: "money", align: "right" },
                  { key: "orders", label: "Số đơn", align: "right" },
                  { key: "prevRevenue", label: "Cùng kỳ năm trước", format: "money", align: "right" },
                  {
                    key: "growth",
                    label: "So cùng kỳ",
                    align: "right",
                    render: (row) => (row.prevRevenue ? `${(((row.revenue - row.prevRevenue) / row.prevRevenue) * 100).toFixed(1)}%` : "—"),
                    tone: (row) => (row.prevRevenue && row.revenue < row.prevRevenue ? "text-red-600" : "text-emerald-700"),
                  },
                ]}
                rows={data.series}
              />
            </div>
          </div>
        ) : null}

        {tab === "tours" ? (
          <div className="mt-3 grid gap-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <h3 className="text-[13px] font-bold text-ink">Lợi nhuận gộp theo tour</h3>
              <ReportBarChart data={data.byTour.slice(0, 10)} valueKey="profit" label="Lợi nhuận" color="#0F766E" height={230} />
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
              <ReportTable
                columns={[
                  { key: "name", label: "Tour" },
                  { key: "orders", label: "Đơn", align: "right" },
                  { key: "guests", label: "Khách", align: "right" },
                  { key: "revenue", label: "Doanh thu", format: "money", align: "right" },
                  { key: "cost", label: "Chi phí", format: "money", align: "right" },
                  { key: "profit", label: "LN gộp", format: "money", align: "right", tone: (row) => (row.profit < 0 ? "text-red-600 font-semibold" : "text-emerald-700 font-semibold") },
                  { key: "margin", label: "Biên", format: "percent", align: "right" },
                ]}
                rows={data.byTour}
              />
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[13px] font-bold text-ink">Theo từng kỳ khởi hành</h3>
              </div>
              <ReportTable
                columns={[
                  { key: "date", label: "Khởi hành", render: (row) => formatDateVN(row.date) },
                  { key: "name", label: "Tour" },
                  { key: "orders", label: "Đơn", align: "right" },
                  { key: "guests", label: "Khách", align: "right" },
                  { key: "revenue", label: "Doanh thu", format: "money", align: "right" },
                  { key: "cost", label: "Chi phí", format: "money", align: "right" },
                  { key: "profit", label: "LN gộp", format: "money", align: "right", tone: (row) => (row.profit < 0 ? "text-red-600 font-semibold" : "text-emerald-700 font-semibold") },
                ]}
                rows={data.byDeparture.slice(0, 25)}
              />
            </div>
          </div>
        ) : null}

        {tab === "channels" ? (
          <div className="mt-3 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <h3 className="text-[13px] font-bold text-ink">Theo nguồn đặt</h3>
              <ReportBarChart data={data.byChannel} valueKey="revenue" label="Doanh thu" color="#0F766E" height={200} />
              <ReportTable
                columns={[
                  { key: "name", label: "Nguồn" },
                  { key: "orders", label: "Đơn", align: "right" },
                  { key: "revenue", label: "Doanh thu", format: "money", align: "right" },
                  { key: "cancelRate", label: "Hủy", format: "percent", align: "right" },
                ]}
                rows={data.byChannel}
                minWidth={520}
              />
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <h3 className="text-[13px] font-bold text-ink">Theo nhân viên sale</h3>
              <ReportBarChart data={data.byStaff} valueKey="revenue" label="Doanh thu" color="#C2410C" height={200} />
              <ReportTable
                columns={[
                  { key: "name", label: "Nhân viên" },
                  { key: "orders", label: "Đơn", align: "right" },
                  { key: "revenue", label: "Doanh thu", format: "money", align: "right" },
                  { key: "cancelRate", label: "Hủy", format: "percent", align: "right" },
                ]}
                rows={data.byStaff}
                minWidth={520}
              />
            </div>
          </div>
        ) : null}

        {tab === "cancel" ? (
          <div className="mt-3 grid gap-4 xl:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[13px] font-bold text-ink">Top lý do hủy</h3>
                <p className="text-[11.5px] text-slate-500">{data.totals.cancelled} đơn hủy · tỷ lệ {data.totals.cancelRate.toFixed(1)}%</p>
              </div>
              <ReportTable
                columns={[
                  { key: "reason", label: "Lý do" },
                  { key: "count", label: "Số đơn", align: "right" },
                ]}
                rows={data.cancelReasons}
                minWidth={420}
              />
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[13px] font-bold text-ink">Hoàn tiền đã chi</h3>
                <p className="text-[11.5px] text-slate-500">Tổng {formatVND(data.totals.refunds)}</p>
              </div>
              <ReportTable
                columns={[
                  { key: "booking_code", label: "Đơn" },
                  { key: "customer_name", label: "Khách" },
                  { key: "amount", label: "Số tiền", align: "right", render: (row) => formatVND(Math.abs(Number(row.amount) || 0)) },
                ]}
                rows={data.refunds}
                minWidth={420}
              />
            </div>
          </div>
        ) : null}

        {tab === "fill" ? (
          <div className="mt-3 grid gap-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
              <h3 className="text-[13px] font-bold text-ink">Tỷ lệ lấp đầy chỗ theo tháng</h3>
              <ReportBarChart data={data.fillRate.map((row) => ({ ...row, name: row.month }))} valueKey="rate" label="Lấp đầy (%)" color="#0284C7" height={230} />
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
              <ReportTable
                columns={[
                  { key: "month", label: "Tháng" },
                  { key: "departures", label: "Số kỳ", align: "right" },
                  { key: "seats", label: "Tổng chỗ", align: "right" },
                  { key: "booked", label: "Đã bán", align: "right" },
                  { key: "rate", label: "Lấp đầy", format: "percent", align: "right" },
                ]}
                rows={data.fillRate}
              />
            </div>
          </div>
        ) : null}

        {tab === "customers" ? (
          <div className="mt-3 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Tổng khách", value: data.customers.total },
                { label: "Khách mới", value: data.customers.newCustomers },
                { label: "Khách quay lại", value: data.customers.returning },
                { label: "NL / TE / EB", value: `${data.customers.paxSplit.adults} / ${data.customers.paxSplit.children} / ${data.customers.paxSplit.infants}` },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-card">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
                  <p className="mt-1 text-[16px] font-bold text-ink tnum">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
              <div className="border-b border-slate-100 px-4 py-3">
                <h3 className="text-[13px] font-bold text-ink">Top 10 khách chi tiêu</h3>
              </div>
              <ReportTable
                columns={[
                  { key: "name", label: "Khách hàng" },
                  { key: "phone", label: "Điện thoại" },
                  { key: "orders", label: "Số đơn", align: "right" },
                  { key: "spent", label: "Chi tiêu", format: "money", align: "right" },
                ]}
                rows={data.customers.topCustomers}
              />
            </div>
          </div>
        ) : null}

        {tab === "aging" ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-[13px] font-bold text-ink">Công nợ theo tuổi nợ</h3>
              <p className="text-[11.5px] text-slate-500">Tuổi nợ tính từ hạn thanh toán (trước khởi hành {settings?.payment_due_days ?? 7} ngày).</p>
            </div>
            <ReportTable
              columns={[
                { key: "bucket", label: "Tuổi nợ" },
                { key: "receivable", label: "Phải thu khách", format: "money", align: "right" },
                { key: "payable", label: "Phải trả đối tác", format: "money", align: "right" },
              ]}
              rows={Object.keys(data.aging.receivableBuckets).map((bucket) => ({
                bucket: `${bucket} ngày`,
                receivable: data.aging.receivableBuckets[bucket],
                payable: data.aging.payableBuckets[bucket],
              }))}
            />
          </div>
        ) : null}
      </div>
    </RequireCapability>
  );
}