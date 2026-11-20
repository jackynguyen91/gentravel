import { Plus, Trash2 } from "lucide-react";
import { Labelled, Section, field, ghostButton, labelText } from "@/components/admin/tours/form-parts";
import { SURCHARGE_UNITS } from "@/lib/tour-catalog";
import { formatVND } from "@/lib/format";
import { childPercent, childPriceNote } from "@/lib/tour-options";

const money = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-[13px] font-semibold text-ink outline-none focus:border-brand tnum";

export default function PricingTab({ form, set }) {
  const setRow = (key) => (index, field2, value) => set(key, form[key].map((row, i) => (i === index ? { ...row, [field2]: value } : row)));

  const setSurcharge = setRow("surcharges");
  const setPeriod = setRow("surcharge_periods");

  const discount = Number(form.discount_percent) || 0;
  const base = Number(form.price_adult) || 0;
  const adultFinal = discount > 0 ? Math.round((base * (100 - discount)) / 100) : base;
  const listed = Number(form.original_price) || base;

  return (
    <div className="space-y-3">
      <Section
        title="Giá niêm yết & giá bán"
        hint="Đơn mới lấy “giá người lớn dùng tính đơn” rồi trừ % giảm — đúng công thức đang chạy, không thay đổi."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Labelled label="Giá niêm yết người lớn">
            <input type="number" min={0} className={money} value={form.original_price ?? form.price_adult} onChange={(e) => set("original_price", e.target.value)} />
          </Labelled>
          <Labelled label="Giá người lớn dùng tính đơn">
            <input type="number" min={0} className={money} value={form.price_adult} onChange={(e) => set("price_adult", e.target.value)} />
          </Labelled>
          <Labelled label="Giảm giá (%)">
            <input type="number" min={0} max={90} className={field} value={form.discount_percent} onChange={(e) => set("discount_percent", e.target.value)} />
          </Labelled>
          <Labelled label="Giảm giá từ ngày">
            <input type="date" className={field} value={form.discount_from || ""} onChange={(e) => set("discount_from", e.target.value)} />
          </Labelled>
          <Labelled label="Giảm giá đến ngày">
            <input type="date" className={field} value={form.discount_to || ""} onChange={(e) => set("discount_to", e.target.value)} />
          </Labelled>
          <div className="flex flex-col justify-end gap-1 rounded-lg bg-brand-50 px-3 py-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brand/70">Giá bán hiển thị</span>
            <span className="text-[15px] font-extrabold text-brand tnum">{formatVND(adultFinal)}</span>
            <span className="text-[10.5px] text-brand/70 tnum">
              {discount > 0 ? `Niêm yết ${formatVND(listed)} · giảm ${discount}%` : "Không giảm giá"}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Giá & chi phí theo đối tượng">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled label="Giá trẻ em">
            <input type="number" min={0} className={money} value={form.price_child} onChange={(e) => set("price_child", e.target.value)} />
          </Labelled>
          <Labelled label="Giá em bé">
            <input type="number" min={0} className={money} value={form.price_infant} onChange={(e) => set("price_infant", e.target.value)} />
          </Labelled>
          <Labelled label="Phụ thu phòng đơn">
            <input
              type="number"
              min={0}
              className={money}
              value={form.price_single_supplement ?? 0}
              onChange={(e) => set("price_single_supplement", e.target.value)}
            />
          </Labelled>
          <Labelled label="Chi phí người lớn">
            <input type="number" min={0} className={money} value={form.cost_adult} onChange={(e) => set("cost_adult", e.target.value)} />
          </Labelled>
          <Labelled label="Chi phí trẻ em">
            <input type="number" min={0} className={money} value={form.cost_child} onChange={(e) => set("cost_child", e.target.value)} />
          </Labelled>
          <Labelled label="Chi phí em bé">
            <input type="number" min={0} className={money} value={form.cost_infant} onChange={(e) => set("cost_infant", e.target.value)} />
          </Labelled>
        </div>
      </Section>

      <Section
        title="Độ tuổi & ghi chú trẻ em"
        hint="Chú thích giá trên trang khách tự sinh từ các ô này. % giá trẻ em tự tính từ Giá trẻ em ÷ Giá người lớn, không nhập tay."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <Labelled label="Tuổi trẻ em từ">
            <input type="number" min={0} max={17} className={field} value={form.child_age_from ?? 2} onChange={(e) => set("child_age_from", e.target.value)} />
          </Labelled>
          <Labelled label="Tuổi trẻ em đến">
            <input type="number" min={0} max={17} className={field} value={form.child_age_to ?? 11} onChange={(e) => set("child_age_to", e.target.value)} />
          </Labelled>
          <Labelled label="Em bé (dưới tuổi)">
            <input type="number" min={0} max={10} className={field} value={form.infant_age_max ?? 2} onChange={(e) => set("infant_age_max", e.target.value)} />
          </Labelled>
          <Labelled label="% giá trẻ em (tự tính)">
            <div className={`${field} flex items-center bg-cloud font-semibold text-brand tnum`}>{childPercent(form)}%</div>
          </Labelled>
          <Labelled label="Ghi chú trẻ em" span>
            <input
              className={field}
              value={form.child_note || ""}
              onChange={(e) => set("child_note", e.target.value)}
              placeholder="VD: ngủ chung phòng với bố mẹ"
            />
          </Labelled>
          <Labelled label="Ghi chú giá em bé" span>
            <input
              className={field}
              value={form.infant_price_note || ""}
              onChange={(e) => set("infant_price_note", e.target.value)}
              placeholder="VD: miễn phí, gia đình tự lo ăn ở"
            />
          </Labelled>
        </div>
        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-[12px] leading-relaxed text-brand-900">
          Xem trước trên trang khách: {childPriceNote({ ...form, child_age_from: form.child_age_from, child_age_to: form.child_age_to })}
        </p>
      </Section>

      <Section title="Phụ thu cố định">
        <div className="space-y-2">
          {(form.surcharges || []).length === 0 && (
            <p className="rounded-lg bg-cloud px-3 py-3 text-[12.5px] text-slate-500">Chưa có phụ thu. Ví dụ: phụ thu phòng đơn, phụ thu đưa đón sân bay.</p>
          )}
          {(form.surcharges || []).map((row, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px_130px_36px]">
              <input className={field} placeholder="Nội dung phụ thu" value={row.label} onChange={(e) => setSurcharge(index, "label", e.target.value)} />
              <input type="number" min={0} className={field} placeholder="Số tiền" value={row.amount} onChange={(e) => setSurcharge(index, "amount", e.target.value)} />
              <select className={field} value={row.unit} onChange={(e) => setSurcharge(index, "unit", e.target.value)}>
                {SURCHARGE_UNITS.map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Xoá phụ thu"
                onClick={() => set("surcharges", form.surcharges.filter((_, i) => i !== index))}
                className="grid h-10 w-9 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => set("surcharges", [...(form.surcharges || []), { label: "", amount: 0, unit: "Mỗi khách" }])}
          className={`${ghostButton} mt-2`}
        >
          <Plus className="h-3.5 w-3.5" /> Thêm phụ thu
        </button>
      </Section>

      <Section title="Phụ thu theo khoảng ngày" hint="Dùng cho lễ, Tết, mùa cao điểm — áp dụng khi ngày khởi hành nằm trong khoảng.">
        <div className="space-y-2">
          {(form.surcharge_periods || []).length === 0 && (
            <p className="rounded-lg bg-cloud px-3 py-3 text-[12.5px] text-slate-500">Chưa có phụ thu theo mùa.</p>
          )}
          {(form.surcharge_periods || []).map((row, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_130px_130px_120px_120px_36px]">
              <input className={field} placeholder="Tên mùa (VD: Lễ 2/9)" value={row.label || ""} onChange={(e) => setPeriod(index, "label", e.target.value)} />
              <input type="date" className={field} value={row.from_date || ""} onChange={(e) => setPeriod(index, "from_date", e.target.value)} />
              <input type="date" className={field} value={row.to_date || ""} onChange={(e) => setPeriod(index, "to_date", e.target.value)} />
              <input type="number" min={0} className={field} placeholder="Số tiền" value={row.amount || 0} onChange={(e) => setPeriod(index, "amount", e.target.value)} />
              <select className={field} value={row.unit || "Mỗi khách"} onChange={(e) => setPeriod(index, "unit", e.target.value)}>
                {SURCHARGE_UNITS.map((unit) => (
                  <option key={unit}>{unit}</option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Xoá phụ thu mùa"
                onClick={() => set("surcharge_periods", form.surcharge_periods.filter((_, i) => i !== index))}
                className="grid h-10 w-9 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            set("surcharge_periods", [...(form.surcharge_periods || []), { label: "", from_date: "", to_date: "", amount: 0, unit: "Mỗi khách" }])
          }
          className={`${ghostButton} mt-2`}
        >
          <Plus className="h-3.5 w-3.5" /> Thêm phụ thu theo mùa
        </button>
        <p className={`${labelText} mt-2 normal-case tracking-normal text-slate-400`}>
          Phụ thu theo mùa chỉ hiển thị để báo giá; công thức tính tiền đơn giữ nguyên.
        </p>
      </Section>
    </div>
  );
}