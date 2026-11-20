import { Plus, Trash2 } from "lucide-react";
import { formatVND } from "@/lib/format";

const input = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-ink outline-none focus:border-brand";

export default function PaymentPolicyCard({ form, update }) {
  const rules = form.default_cancellation || [];

  const setRule = (index, key, value) => {
    const next = rules.map((rule, i) => (i === index ? { ...rule, [key]: value } : rule));
    update("default_cancellation", next);
  };

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
      <h3 className="text-[13px] font-bold text-ink">Hạn thanh toán & chính sách hủy</h3>
      <p className="mt-0.5 text-[11.5px] text-slate-500">
        Áp dụng cho công nợ phải thu và số tiền hoàn khi hủy đơn (tour chưa có chính sách riêng).
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[11.5px] font-medium text-slate-500">
          Hạn thanh toán trước khởi hành (ngày)
          <input
            type="number"
            min={0}
            max={90}
            className={input}
            value={form.payment_due_days}
            onChange={(e) => update("payment_due_days", Number(e.target.value))}
          />
        </label>
        <label className="text-[11.5px] font-medium text-slate-500">
          Ngưỡng hạng Thân thiết
          <input
            type="number"
            step={1000000}
            className={input}
            value={form.tier_loyal_min}
            onChange={(e) => update("tier_loyal_min", Number(e.target.value))}
          />
        </label>
        <label className="text-[11.5px] font-medium text-slate-500">
          Ngưỡng hạng VIP
          <input
            type="number"
            step={1000000}
            className={input}
            value={form.tier_vip_min}
            onChange={(e) => update("tier_vip_min", Number(e.target.value))}
          />
        </label>
        <p className="self-end text-[11px] text-slate-400">
          Thân thiết từ {formatVND(form.tier_loyal_min)} · VIP từ {formatVND(form.tier_vip_min)} doanh thu.
        </p>
      </div>

      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Chính sách hủy mặc định</p>
      <div className="mt-1.5 space-y-1.5">
        {rules.map((rule, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <input
              type="number"
              aria-label={`Hủy trước ${index + 1} ngày`}
              className={input}
              value={rule.days_before}
              onChange={(e) => setRule(index, "days_before", Number(e.target.value))}
            />
            <span className="text-[11.5px] text-slate-500">ngày → phí</span>
            <input
              type="number"
              aria-label={`Phí hủy ${index + 1}`}
              className={input}
              value={rule.fee_percent}
              onChange={(e) => setRule(index, "fee_percent", Number(e.target.value))}
            />
            <span className="text-[11.5px] text-slate-500">%</span>
            <button
              type="button"
              aria-label="Xóa dòng chính sách"
              onClick={() => update("default_cancellation", rules.filter((_, i) => i !== index))}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => update("default_cancellation", [...rules, { days_before: 0, fee_percent: 100, note: "" }])}
        className="mt-2 inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11.5px] font-semibold text-slate-600 hover:text-brand"
      >
        <Plus className="h-3.5 w-3.5" /> Thêm mốc
      </button>
    </section>
  );
}