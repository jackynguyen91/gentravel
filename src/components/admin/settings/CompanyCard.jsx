const input = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-ink outline-none focus:border-brand";

export default function CompanyCard({ form, update }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
      <h3 className="text-[13px] font-bold text-ink">Thông tin công ty</h3>
      <p className="mt-0.5 text-[11.5px] text-slate-500">Dùng cho phiếu thu, hóa đơn và email xác nhận.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[11.5px] font-medium text-slate-500">
          Tên công ty
          <input className={input} value={form.company_name} onChange={(e) => update("company_name", e.target.value)} />
        </label>
        <label className="text-[11.5px] font-medium text-slate-500">
          Mã số thuế
          <input className={input} value={form.tax_code} onChange={(e) => update("tax_code", e.target.value)} placeholder="0312345678" />
        </label>
        <label className="text-[11.5px] font-medium text-slate-500 sm:col-span-2">
          Logo (URL)
          <input className={input} value={form.logo_url} onChange={(e) => update("logo_url", e.target.value)} placeholder="https://…" />
        </label>
        <label className="text-[11.5px] font-medium text-slate-500 sm:col-span-2">
          Địa chỉ
          <input className={input} value={form.address} onChange={(e) => update("address", e.target.value)} />
        </label>
        <label className="text-[11.5px] font-medium text-slate-500">
          Hotline
          <input className={input} value={form.hotline} onChange={(e) => update("hotline", e.target.value)} />
        </label>
        <label className="text-[11.5px] font-medium text-slate-500">
          Email liên hệ
          <input className={input} value={form.email} onChange={(e) => update("email", e.target.value)} />
        </label>
      </div>

      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Tài khoản nhận tiền</p>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        <label className="text-[11.5px] font-medium text-slate-500">
          Ngân hàng
          <input className={input} value={form.bank_name} onChange={(e) => update("bank_name", e.target.value)} placeholder="Vietcombank" />
        </label>
        <label className="text-[11.5px] font-medium text-slate-500">
          Mã VietQR
          <input className={input} value={form.bank_id} onChange={(e) => update("bank_id", e.target.value)} placeholder="970436" />
        </label>
        <label className="text-[11.5px] font-medium text-slate-500">
          Số tài khoản
          <input className={input} value={form.account_number} onChange={(e) => update("account_number", e.target.value)} />
        </label>
        <label className="text-[11.5px] font-medium text-slate-500">
          Chủ tài khoản
          <input className={input} value={form.account_name} onChange={(e) => update("account_name", e.target.value)} />
        </label>
      </div>
    </section>
  );
}