const input = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-ink outline-none focus:border-brand";

const TOKENS = ["{customer_name}", "{tour_title}", "{booking_code}", "{departure_date}", "{total_price}"];

export default function EmailTemplateCard({ form, update }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
      <h3 className="text-[13px] font-bold text-ink">Mẫu email xác nhận</h3>
      <p className="mt-0.5 text-[11.5px] text-slate-500">Dùng khi gửi email xác nhận đơn cho khách.</p>
      <div className="mt-3 space-y-2">
        <label className="block text-[11.5px] font-medium text-slate-500">
          Tiêu đề
          <input className={input} value={form.email_subject} onChange={(e) => update("email_subject", e.target.value)} />
        </label>
        <label className="block text-[11.5px] font-medium text-slate-500">
          Nội dung
          <textarea
            rows={7}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none focus:border-brand"
            value={form.email_body}
            onChange={(e) => update("email_body", e.target.value)}
          />
        </label>
        <p className="text-[10.5px] text-slate-400">Biến dùng được: {TOKENS.join(" · ")}</p>
      </div>
    </section>
  );
}