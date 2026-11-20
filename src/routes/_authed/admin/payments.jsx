import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCheck, Download, Plus, QrCode, Search } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import RequireCapability from "@/components/admin/RequireCapability";
import PaymentsTable from "@/components/admin/payments/PaymentsTable";
import PaymentDialog from "@/components/admin/payments/PaymentDialog";
import VietQrSettingsDialog from "@/components/admin/payments/VietQrSettingsDialog";
import ReceivablesPanel from "@/components/admin/payments/ReceivablesPanel";
import PayablesPanel from "@/components/admin/payments/PayablesPanel";
import RefundsPanel from "@/components/admin/payments/RefundsPanel";
import { payablesOf, receivablesOf, cashIn, REFUND_PENDING, METHOD_STYLE } from "@/lib/payment-utils";
import { bulkReconcile, decideRefund } from "@/lib/admin-payments-fns";
import { loadSettings } from "@/lib/settings";
import { stripSample } from "@/lib/demo";
import { can } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { exportCsv } from "@/lib/report-export";
import { formatVND } from "@/lib/format";

export const Route = createFileRoute("/_authed/admin/payments")({
  component: AdminPayments,
});

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const METHODS = ["Chuyển khoản", "VNPay", "MoMo", "Tiền mặt", "VietQR", "Thẻ tín dụng", "Đại lý thu"];
const STATUSES = ["Đã thanh toán", "Chờ xử lý", REFUND_PENDING, "Thất bại", "Đã hoàn tiền"];
const PERIODS = [
  { key: "day", label: "Ngày" },
  { key: "week", label: "Tuần" },
  { key: "month", label: "Tháng" },
];

const periodKey = (row, period) => {
  const iso = String(row.paid_at || row.created_date || "").slice(0, 10);
  if (!iso) return "—";
  if (period === "month") return iso.slice(0, 7);
  if (period === "week") {
    const date = new Date(`${iso}T00:00:00`);
    const day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day);
    return date.toISOString().slice(0, 10);
  }
  return iso;
};

const periodLabel = (key, period) => {
  if (period === "month" && key.length === 7) {
    const [year, month] = key.split("-");
    return `Tháng ${Number(month)}/${year}`;
  }
  if (period === "week") return `Tuần từ ${key.split("-").reverse().join("/")}`;
  return key.split("-").reverse().join("/");
};

function AdminPayments() {
  const { user } = useAuth();
  const reconcileMany = useServerFn(bulkReconcile);
  const decide = useServerFn(decideRefund);
  const [tab, setTab] = useState("transactions");
  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [partners, setPartners] = useState([]);
  const [tours, setTours] = useState([]);
  const [costs, setCosts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [direction, setDirection] = useState("all");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("month");
  const [selected, setSelected] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vietQrOpen, setVietQrOpen] = useState(false);
  const [presetBooking, setPresetBooking] = useState(null);
  const [presetPartner, setPresetPartner] = useState(null);

  const load = async () => {
    const [{ settings: cfg }, paymentRows, bookingRows, partnerRows, tourRows, costRows] = await Promise.all([
      loadSettings(),
      base44.entities.Payment.list({ sort: "-paid_at", limit: 500 }),
      base44.entities.Booking.list({ sort: "-booking_date", limit: 500 }),
      base44.entities.Partner.list({ sort: "name", limit: 200 }),
      base44.entities.Tour.list({ limit: 200 }),
      base44.entities.TourCost.list({ limit: 500 }),
    ]);
    setSettings(cfg);
    setPayments(stripSample(asArray(paymentRows), cfg));
    setBookings(stripSample(asArray(bookingRows), cfg));
    setPartners(asArray(partnerRows));
    setTours(asArray(tourRows));
    setCosts(stripSample(asArray(costRows), cfg));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const dueDays = settings?.payment_due_days ?? 7;
  const receivables = useMemo(() => receivablesOf(bookings, payments, dueDays), [bookings, payments, dueDays]);
  const payables = useMemo(() => payablesOf({ partners, tours, costs, bookings, payments }), [partners, tours, costs, bookings, payments]);
  const refundRequests = useMemo(() => payments.filter((row) => row.kind === "Hoàn tiền" && row.status === REFUND_PENDING), [payments]);

  const totals = useMemo(() => {
    const { gross, refunds, net } = cashIn(payments);
    const paidOut = payments
      .filter((row) => row.direction === "Chi đối tác" && row.status === "Đã thanh toán")
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const unreconciled = payments.filter((row) => !row.reconciled);
    return {
      received: net,
      gross,
      refunds,
      paidOut,
      unreconciledCount: unreconciled.length,
      unreconciledAmount: unreconciled.reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0),
      receivableTotal: receivables.reduce((sum, row) => sum + row.remaining, 0),
      payableTotal: payables.reduce((sum, row) => sum + row.remaining, 0),
      overdueCount: receivables.filter((row) => row.overdue).length,
    };
  }, [payments, receivables, payables]);

  const visiblePayments = useMemo(() => {
    const search = keyword.trim().toLowerCase();
    return payments.filter((row) => {
      const directionOk = direction === "all" || row.direction === direction;
      const methodOk = method === "all" || row.method === method;
      const statusOk = status === "all" || row.status === status;
      const searchOk =
        !search ||
        [row.customer_name, row.partner_name, row.booking_code, row.receipt_no, row.note, row.confirmed_by]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      return directionOk && methodOk && statusOk && searchOk;
    });
  }, [payments, keyword, direction, method, status]);

  const groups = useMemo(() => {
    const map = new Map();
    visiblePayments.forEach((row) => {
      const key = periodKey(row, period);
      const entry = map.get(key) || { key, income: 0, expense: 0, refund: 0, count: 0 };
      const amount = Number(row.amount) || 0;
      if (row.kind === "Hoàn tiền" || amount < 0) entry.refund += Math.abs(amount);
      else if (row.direction === "Chi đối tác") entry.expense += amount;
      else if (row.status === "Đã thanh toán") entry.income += amount;
      entry.count += 1;
      map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 12);
  }, [visiblePayments, period]);

  const toggleReconcile = async (row) => {
    const reconciled = !row.reconciled;
    await base44.entities.Payment.update(row.id, {
      reconciled,
      reconciled_at: reconciled ? new Date().toISOString() : "",
    });
    await logActivity({
      module: "Thanh toán",
      action: reconciled ? "Đối soát giao dịch" : "Bỏ đối soát giao dịch",
      detail: `${formatVND(row.amount)} · ${row.booking_code || row.partner_name || ""}`,
      entity_id: row.id,
      actor: user?.full_name || user?.email || "",
    });
    await load();
  };

  const reconcileSelected = async () => {
    const ids = selected.filter((id) => {
      const row = payments.find((item) => item.id === id);
      return row && !row.reconciled;
    });
    if (ids.length === 0) {
      toast.info("Chọn ít nhất một giao dịch chưa đối soát.");
      return;
    }
    const result = await reconcileMany({ data: { ids } });
    setSelected([]);
    await load();
    toast.success(`Đã đối soát ${result?.updated ?? ids.length} giao dịch`);
  };

  const exportStatement = () => {
    exportCsv(
      `sao-ke-thanh-toan-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Mã giao dịch", "Đơn", "Khách / Đối tác", "Loại", "Nội dung", "Số tiền", "Phương thức", "Ngày nhận", "Người xác nhận", "Chứng từ", "Đã đối soát"],
      visiblePayments.map((row) => [
        row.receipt_no || row.id,
        row.booking_code || "",
        row.direction === "Chi đối tác" ? row.partner_name || "" : row.customer_name || "",
        row.direction === "Chi đối tác" ? "Chi đối tác" : row.kind === "Hoàn tiền" ? "Hoàn tiền" : "Thu khách",
        row.kind || "",
        Math.round(Number(row.amount) || 0),
        row.method || "",
        String(row.paid_at || row.created_date || "").slice(0, 10),
        row.confirmed_by || "",
        row.receipt_file_uri ? "Có" : "",
        row.reconciled ? "Đã đối soát" : "",
      ]),
    );
  };

  const decideRefundRow = async (row, approve) => {
    setBusyId(row.id);
    try {
      const result = await decide({ data: { payment_id: row.id, approve } });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(approve ? "Đã duyệt hoàn tiền" : "Đã từ chối yêu cầu hoàn tiền");
        await load();
      }
    } catch {
      toast.error("Không có quyền duyệt hoàn tiền.");
    } finally {
      setBusyId("");
    }
  };

  const openCollect = (booking) => {
    setPresetPartner(null);
    setPresetBooking(booking);
    setDialogOpen(true);
  };

  const openPayout = (partner) => {
    setPresetBooking(null);
    setPresetPartner(partner);
    setDialogOpen(true);
  };

  const canApproveRefund = can(user, "approve_refund");

  return (
    <RequireCapability user={user} capability="payments">
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink">Thanh toán & công nợ</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Thực thu {formatVND(totals.received)} (đã trừ hoàn {formatVND(totals.refunds)}) · phải thu {formatVND(totals.receivableTotal)} · phải trả{" "}
            {formatVND(totals.payableTotal)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportStatement}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-cloud"
          >
            <Download className="h-4 w-4" /> Sao kê Excel
          </button>
          <button
            type="button"
            onClick={() => setVietQrOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-cloud"
          >
            <QrCode className="h-4 w-4" /> Cấu hình VietQR
          </button>
          <button
            type="button"
            onClick={() => {
              setPresetBooking(null);
              setPresetPartner(null);
              setDialogOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Ghi nhận giao dịch
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Thực thu (đã trừ hoàn)", value: formatVND(totals.received), hint: `Thu ${formatVND(totals.gross)} · hoàn ${formatVND(totals.refunds)}` },
          { label: "Phải thu khách", value: formatVND(totals.receivableTotal), hint: `${receivables.length} đơn còn nợ · ${totals.overdueCount} quá hạn` },
          { label: "Phải trả đối tác", value: formatVND(totals.payableTotal), hint: `${payables.length} nhà cung cấp` },
          { label: "Chưa đối soát", value: String(totals.unreconciledCount), hint: formatVND(totals.unreconciledAmount) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-card">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
            <p className="mt-1 text-[16px] font-bold text-ink tnum">{item.value}</p>
            <p className="text-[10.5px] text-slate-400">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-1.5 rounded-xl border border-slate-100 bg-white p-1.5 shadow-card">
        {[
          { key: "transactions", label: "Giao dịch" },
          { key: "receivables", label: `Phải thu (${receivables.length})` },
          { key: "payables", label: `Phải trả (${payables.length})` },
          { key: "refunds", label: `Hoàn tiền (${refundRequests.length})` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`h-9 flex-1 rounded-lg px-3 text-[12.5px] font-semibold transition ${tab === item.key ? "bg-brand text-white" : "text-slate-600 hover:bg-cloud"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "transactions" ? (
        <>
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-card lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm khách, đối tác, mã đơn, số phiếu…"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12.5px] text-ink outline-none focus:border-brand"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <select value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Loại giao dịch" className="h-9 rounded-lg border border-slate-200 px-2 text-[12px] text-slate-600">
                <option value="all">Mọi loại</option>
                <option value="Thu từ khách">Thu từ khách</option>
                <option value="Chi đối tác">Chi đối tác</option>
              </select>
              <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Phương thức" className="h-9 rounded-lg border border-slate-200 px-2 text-[12px] text-slate-600">
                <option value="all">Mọi phương thức</option>
                {METHODS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Trạng thái" className="h-9 rounded-lg border border-slate-200 px-2 text-[12px] text-slate-600">
                <option value="all">Mọi trạng thái</option>
                {STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <div className="flex rounded-lg border border-slate-200 p-0.5">
                {PERIODS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPeriod(item.key)}
                    className={`rounded-md px-2 py-1 text-[11.5px] font-semibold ${period === item.key ? "bg-brand text-white" : "text-slate-500"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={reconcileSelected}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11.5px] font-semibold text-slate-600 hover:text-brand"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Đối soát đã chọn ({selected.length})
              </button>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
            <div className="border-b border-slate-100 px-4 py-2.5 text-[11.5px] text-slate-500">
              Tổng hợp theo {period === "day" ? "ngày" : period === "week" ? "tuần" : "tháng"}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead className="bg-cloud text-[10.5px] uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Kỳ</th>
                    <th className="px-3 py-2 text-right font-semibold">Thu khách</th>
                    <th className="px-3 py-2 text-right font-semibold">Hoàn tiền</th>
                    <th className="px-3 py-2 text-right font-semibold">Chi đối tác</th>
                    <th className="px-3 py-2 text-right font-semibold">Thực thu</th>
                    <th className="px-3 py-2 text-right font-semibold">Giao dịch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groups.map((group) => (
                    <tr key={group.key} className="hover:bg-cloud/60">
                      <td className="px-4 py-2 font-semibold text-ink">{periodLabel(group.key, period)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700 tnum">{formatVND(group.income)}</td>
                      <td className="px-3 py-2 text-right text-rose-700 tnum">{formatVND(group.refund)}</td>
                      <td className="px-3 py-2 text-right text-purple-700 tnum">{formatVND(group.expense)}</td>
                      <td className="px-3 py-2 text-right font-bold text-ink tnum">{formatVND(group.income - group.refund)}</td>
                      <td className="px-3 py-2 text-right text-slate-500 tnum">{group.count}</td>
                    </tr>
                  ))}
                  {groups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                        Chưa có giao dịch trong bộ lọc này.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3">
            <PaymentsTable
              items={visiblePayments}
              loading={loading}
              onToggleReconcile={toggleReconcile}
              selected={selected}
              onToggleSelect={(id) => setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))}
              onToggleAll={(ids) => setSelected((prev) => (ids.every((id) => prev.includes(id)) ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]))}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {METHODS.map((item) => (
              <span key={item} className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${METHOD_STYLE[item]}`}>
                {item}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {tab === "receivables" ? (
        <div className="mt-3">
          <ReceivablesPanel rows={receivables} loading={loading} onCollect={openCollect} />
        </div>
      ) : null}

      {tab === "payables" ? (
        <div className="mt-3">
          <PayablesPanel rows={payables} loading={loading} onPay={openPayout} />
        </div>
      ) : null}

      {tab === "refunds" ? (
        <div className="mt-3">
          <RefundsPanel rows={refundRequests} loading={loading} canApprove={canApproveRefund} onDecide={decideRefundRow} busyId={busyId} />
        </div>
      ) : null}

      <VietQrSettingsDialog open={vietQrOpen} onOpenChange={setVietQrOpen} />

      <PaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bookings={bookings}
        partners={partners}
        payments={payments}
        presetBooking={presetBooking}
        presetPartner={presetPartner}
        onSaved={load}
      />
    </div>
    </RequireCapability>
  );
}