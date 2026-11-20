import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { saveService } from "@/lib/admin-services-fns";
import { PRICE_KINDS, PRICE_UNITS, SERVICE_STATUSES, suggestedPrice } from "@/lib/service-catalog";
import { toLines, fromLines } from "@/lib/slugify";

const field = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-ink outline-none focus:border-brand";
const area = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[13px] leading-relaxed text-ink outline-none focus:border-brand";
const labelText = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const sectionTitle = "flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400";

const EMPTY = {
  title: "",
  slug: "",
  type: "Vé máy bay",
  summary: "",
  description: "",
  image: "",
  images: [],
  destination: "",
  status: "Đang hiển thị",
  sort_order: 0,
  price: 0,
  price_unit: "vé",
  price_kind: "",
  price_includes_tax: true,
  price_note: "",
  price_needs_review: false,
  price_rules: [],
  seasonal_prices: [],
  cost_price: 0,
  markup_percent: 0,
  service_fee: 0,
  supplier_name: "",
  seo_title: "",
  seo_description: "",
  flight: {},
  ticket: {},
  hotel: { room_types: [], amenities: [] },
  visa: { documents: [] },
  transport: {},
};

export default function ServiceFormDialog({ open, onOpenChange, service, onSaved, types, destinations, canSeeCost }) {
  const save = useServerFn(saveService);
  const [form, setForm] = useState(EMPTY);
  const [highlights, setHighlights] = useState("");
  const [imagesText, setImagesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    const base = { ...EMPTY, ...(service || {}) };
    base.images = Array.isArray(base.images) ? base.images : base.image ? [base.image] : [];
    base.hotel = { room_types: [], amenities: [], ...(service?.hotel || {}) };
    base.visa = { documents: [], ...(service?.visa || {}) };
    base.ticket = { included: [], excluded: [], ...(service?.ticket || {}) };
    base.price_rules = Array.isArray(base.price_rules) ? base.price_rules : [];
    base.seasonal_prices = Array.isArray(base.seasonal_prices) ? base.seasonal_prices : [];
    setForm(base);
    setHighlights(toLines(service?.highlights));
    setImagesText(toLines(base.images));
  }, [open, service]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setIn = (group, key, value) => setForm((prev) => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
  const setList = (group, key, value) =>
    setForm((prev) => ({ ...prev, [group]: { ...prev[group], [key]: fromLines(value) } }));

  const patchRule = (index, key, value) => {
    const next = [...form.price_rules];
    next[index] = { ...next[index], [key]: key.endsWith("percent") || key.includes("_value") ? Number(value) : value };
    set("price_rules", next);
  };

  const patchSeason = (index, key, value) => {
    const next = [...form.seasonal_prices];
    next[index] = { ...next[index], [key]: key === "price" ? Number(value) : value };
    set("seasonal_prices", next);
  };

  const handleSave = async () => {
    if (form.title.trim().length < 2) return setError("Vui lòng nhập tên dịch vụ.");
    setSaving(true);
    setError("");
    try {
      const images = fromLines(imagesText);
      await save({
        data: {
          id: service?.id,
          title: form.title.trim(),
          slug: form.slug || "",
          type: form.type,
          summary: form.summary || "",
          description: form.description || "",
          highlights: fromLines(highlights),
          image: images[0] || form.image || "",
          images,
          destination: form.destination || "",
          status: form.status,
          sort_order: Number(form.sort_order) || 0,
          price: Number(form.price) || 0,
          price_unit: form.price_unit || "",
          price_kind: form.price_kind || "",
          price_includes_tax: Boolean(form.price_includes_tax),
          price_note: form.price_note || "",
          price_needs_review: Boolean(form.price_needs_review),
          price_rules: form.price_rules.filter((rule) => rule?.audience),
          seasonal_prices: form.seasonal_prices.filter((row) => row?.label || row?.price),
          cost_price: Number(form.cost_price) || 0,
          markup_percent: Number(form.markup_percent) || 0,
          service_fee: Number(form.service_fee) || 0,
          supplier_name: form.supplier_name || "",
          flight: form.flight || {},
          ticket: form.ticket || {},
          hotel: form.hotel || {},
          visa: form.visa || {},
          transport: form.transport || {},
          seo_title: form.seo_title || "",
          seo_description: form.seo_description || "",
        },
      });
      toast.success(service ? "Đã lưu dịch vụ" : "Đã tạo dịch vụ");
      onSaved?.();
      onOpenChange(false);
    } catch {
      setError("Chưa lưu được dịch vụ. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const suggested = suggestedPrice(form);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogTitle className="font-heading text-lg font-extrabold text-ink">
          {service ? "Chỉnh sửa dịch vụ" : "Thêm dịch vụ mới"}
        </DialogTitle>
        <DialogDescription className="text-[12.5px] text-slate-500">
          Thông tin chung, giá bán và trường riêng theo loại dịch vụ.
        </DialogDescription>

        <div className="mt-4 space-y-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelText}>Tên dịch vụ</label>
              <input className={field} value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <label className={labelText}>Loại dịch vụ</label>
              <select className={field} value={form.type} onChange={(e) => set("type", e.target.value)}>
                {types.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelText}>Điểm đến</label>
              <select className={field} value={form.destination} onChange={(e) => set("destination", e.target.value)}>
                <option value="">Chưa gán</option>
                {[...new Set([...(destinations || []), form.destination].filter(Boolean))].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelText}>Trạng thái</label>
              <select className={field} value={form.status} onChange={(e) => set("status", e.target.value)}>
                {SERVICE_STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelText}>Thứ tự hiển thị</label>
              <input type="number" className={field} value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelText}>Mô tả ngắn</label>
              <textarea rows={2} className={area} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelText}>Mô tả chi tiết</label>
              <textarea rows={3} className={area} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelText}>Ảnh (mỗi dòng một URL, ảnh đầu là ảnh đại diện)</label>
              <textarea rows={2} className={area} value={imagesText} onChange={(e) => setImagesText(e.target.value)} placeholder="https://…" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelText}>Điểm nổi bật (mỗi dòng một ý)</label>
              <textarea rows={3} className={area} value={highlights} onChange={(e) => setHighlights(e.target.value)} />
            </div>
            <div>
              <label className={labelText}>Nhà cung cấp</label>
              <input className={field} value={form.supplier_name || ""} onChange={(e) => set("supplier_name", e.target.value)} />
            </div>
            <div>
              <label className={labelText}>Đường dẫn (slug)</label>
              <input className={field} value={form.slug || ""} onChange={(e) => set("slug", e.target.value)} placeholder="Để trống để tự tạo" />
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <h3 className={sectionTitle}>Giá bán</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelText}>Giá (VND)</label>
                <input type="number" min={0} className={field} value={form.price || 0} onChange={(e) => set("price", e.target.value)} />
              </div>
              <div>
                <label className={labelText}>Đơn vị</label>
                <select className={field} value={form.price_unit || ""} onChange={(e) => set("price_unit", e.target.value)}>
                  <option value="">—</option>
                  {PRICE_UNITS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelText}>Loại giá</label>
                <select className={field} value={form.price_kind || ""} onChange={(e) => set("price_kind", e.target.value)}>
                  <option value="">—</option>
                  {PRICE_KINDS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelText}>Ghi chú giá</label>
                <input className={field} value={form.price_note || ""} onChange={(e) => set("price_note", e.target.value)} />
              </div>
              <label className="flex items-center gap-2 self-end text-[12.5px] font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={Boolean(form.price_includes_tax)}
                  onChange={(e) => set("price_includes_tax", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                Đã gồm thuế phí
              </label>
            </div>
            {form.price_needs_review ? (
              <p className="mt-2 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[11.5px] font-medium text-orange-700">
                Giá cũ chưa tách được số — đang giữ nguyên trong ghi chú, cần rà soát.
              </p>
            ) : null}

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Quy tắc giá theo đối tượng</span>
                <button
                  type="button"
                  onClick={() => set("price_rules", [...form.price_rules, { audience: "Trẻ em", basis: "Chiều cao", discount_percent: 20 }])}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand"
                >
                  <Plus className="h-3 w-3" /> Thêm quy tắc
                </button>
              </div>
              {form.price_rules.length === 0 ? (
                <p className="mt-1 text-[11.5px] text-slate-400">Ví dụ: trẻ 1m–1m4 giảm 20%, em bé dưới 1m miễn phí.</p>
              ) : (
                <div className="mt-1.5 space-y-1.5">
                  {form.price_rules.map((rule, index) => (
                    <div key={index} className="grid grid-cols-2 gap-1.5 sm:grid-cols-6">
                      <select className={field} value={rule.audience || "Trẻ em"} onChange={(e) => patchRule(index, "audience", e.target.value)}>
                        {["Người lớn", "Trẻ em", "Em bé", "Người cao tuổi"].map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                      <select className={field} value={rule.basis || "Chiều cao"} onChange={(e) => patchRule(index, "basis", e.target.value)}>
                        {["Độ tuổi", "Chiều cao"].map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                      <input type="number" className={field} placeholder="Từ" value={rule.min_value ?? ""} onChange={(e) => patchRule(index, "min_value", e.target.value)} />
                      <input type="number" className={field} placeholder="Đến" value={rule.max_value ?? ""} onChange={(e) => patchRule(index, "max_value", e.target.value)} />
                      <input type="number" className={field} placeholder="Giảm %" value={rule.discount_percent ?? ""} onChange={(e) => patchRule(index, "discount_percent", e.target.value)} />
                      <button
                        type="button"
                        onClick={() => set("price_rules", form.price_rules.filter((_, i) => i !== index))}
                        className="grid h-9 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600"
                        aria-label="Xóa quy tắc"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Bảng giá theo khoảng ngày (khách sạn, vé máy bay)
                </span>
                <button
                  type="button"
                  onClick={() => set("seasonal_prices", [...form.seasonal_prices, { label: "", from_date: "", to_date: "", price: 0 }])}
                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand"
                >
                  <Plus className="h-3 w-3" /> Thêm giai đoạn
                </button>
              </div>
              {form.seasonal_prices.length ? (
                <div className="mt-1.5 space-y-1.5">
                  {form.seasonal_prices.map((row, index) => (
                    <div key={index} className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                      <input className={field} placeholder="Tên mùa / giai đoạn" value={row.label || ""} onChange={(e) => patchSeason(index, "label", e.target.value)} />
                      <input type="date" className={field} value={row.from_date || ""} onChange={(e) => patchSeason(index, "from_date", e.target.value)} />
                      <input type="date" className={field} value={row.to_date || ""} onChange={(e) => patchSeason(index, "to_date", e.target.value)} />
                      <input type="number" className={field} placeholder="Giá" value={row.price ?? ""} onChange={(e) => patchSeason(index, "price", e.target.value)} />
                      <button
                        type="button"
                        onClick={() => set("seasonal_prices", form.seasonal_prices.filter((_, i) => i !== index))}
                        className="grid h-9 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600"
                        aria-label="Xóa giai đoạn"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {canSeeCost ? (
              <div className="mt-3 grid gap-3 rounded-lg border border-dashed border-slate-200 bg-white p-2.5 sm:grid-cols-3">
                <div>
                  <label className={labelText}>Giá nhập (VND)</label>
                  <input type="number" min={0} className={field} value={form.cost_price || 0} onChange={(e) => set("cost_price", e.target.value)} />
                </div>
                <div>
                  <label className={labelText}>Markup (%)</label>
                  <input type="number" min={0} className={field} value={form.markup_percent || 0} onChange={(e) => set("markup_percent", e.target.value)} />
                </div>
                <div>
                  <label className={labelText}>Phí dịch vụ (VND)</label>
                  <input type="number" min={0} className={field} value={form.service_fee || 0} onChange={(e) => set("service_fee", e.target.value)} />
                </div>
                {suggested > 0 ? (
                  <p className="text-[11.5px] text-slate-500 sm:col-span-3">
                    Giá bán gợi ý từ giá nhập + markup: <strong className="text-ink">{suggested.toLocaleString("vi-VN")}₫</strong>
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          {form.type === "Vé máy bay" ? (
            <section className="rounded-xl border border-slate-100 p-3">
              <h3 className={sectionTitle}>Chi tiết vé máy bay</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <select className={field} value={form.flight?.scope || "Nội địa"} onChange={(e) => setIn("flight", "scope", e.target.value)}>
                  {["Nội địa", "Quốc tế"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <input className={field} placeholder="Hãng bay" value={form.flight?.airline || ""} onChange={(e) => setIn("flight", "airline", e.target.value)} />
                <select className={field} value={form.flight?.trip_type || "Một chiều"} onChange={(e) => setIn("flight", "trip_type", e.target.value)}>
                  {["Một chiều", "Khứ hồi"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <input className={field} placeholder="Điểm đi" value={form.flight?.from_place || ""} onChange={(e) => setIn("flight", "from_place", e.target.value)} />
                <input className={field} placeholder="Điểm đến" value={form.flight?.to_place || ""} onChange={(e) => setIn("flight", "to_place", e.target.value)} />
                <input className={field} placeholder="Hành lý xách tay" value={form.flight?.baggage_carry || ""} onChange={(e) => setIn("flight", "baggage_carry", e.target.value)} />
                <input className={field} placeholder="Hành lý ký gửi" value={form.flight?.baggage_checked || ""} onChange={(e) => setIn("flight", "baggage_checked", e.target.value)} />
                <div className="sm:col-span-2">
                  <input className={field} placeholder="Quy định đổi / hoàn vé" value={form.flight?.change_policy || ""} onChange={(e) => setIn("flight", "change_policy", e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <input className={field} placeholder="Ghi chú giá thay đổi theo ngày" value={form.flight?.price_by_date_note || ""} onChange={(e) => setIn("flight", "price_by_date_note", e.target.value)} />
                </div>
              </div>
            </section>
          ) : null}

          {form.type === "Vé tham quan" ? (
            <section className="rounded-xl border border-slate-100 p-3">
              <h3 className={sectionTitle}>Chi tiết vé tham quan</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input className={field} placeholder="Địa điểm" value={form.ticket?.venue || ""} onChange={(e) => setIn("ticket", "venue", e.target.value)} />
                <input className={field} placeholder="Loại vé (ngày / combo)" value={form.ticket?.ticket_type || ""} onChange={(e) => setIn("ticket", "ticket_type", e.target.value)} />
                <input className={field} placeholder="Đối tượng áp dụng" value={form.ticket?.audience || ""} onChange={(e) => setIn("ticket", "audience", e.target.value)} />
                <input className={field} placeholder="Giờ mở cửa" value={form.ticket?.open_hours || ""} onChange={(e) => setIn("ticket", "open_hours", e.target.value)} />
                <input className={field} placeholder="Hạn sử dụng vé" value={form.ticket?.validity || ""} onChange={(e) => setIn("ticket", "validity", e.target.value)} />
                <select className={field} value={form.ticket?.delivery || "E-ticket"} onChange={(e) => setIn("ticket", "delivery", e.target.value)}>
                  {["E-ticket", "Nhận tại quầy"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <div className="sm:col-span-3">
                  <label className={labelText}>Bao gồm (mỗi dòng một ý)</label>
                  <textarea rows={2} className={area} value={toLines(form.ticket?.included)} onChange={(e) => setList("ticket", "included", e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelText}>Không bao gồm (mỗi dòng một ý)</label>
                  <textarea rows={2} className={area} value={toLines(form.ticket?.excluded)} onChange={(e) => setList("ticket", "excluded", e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <input className={field} placeholder="Chính sách đổi / hoàn" value={form.ticket?.refund_policy || ""} onChange={(e) => setIn("ticket", "refund_policy", e.target.value)} />
                </div>
              </div>
            </section>
          ) : null}

          {form.type === "Khách sạn" ? (
            <section className="rounded-xl border border-slate-100 p-3">
              <h3 className={sectionTitle}>Chi tiết khách sạn</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input type="number" min={0} max={5} className={field} placeholder="Hạng sao" value={form.hotel?.stars ?? ""} onChange={(e) => setIn("hotel", "stars", e.target.value)} />
                <input className={field} placeholder="Khu vực" value={form.hotel?.area || ""} onChange={(e) => setIn("hotel", "area", e.target.value)} />
                <input className={field} placeholder="Giờ nhận phòng" value={form.hotel?.checkin || ""} onChange={(e) => setIn("hotel", "checkin", e.target.value)} />
                <div className="sm:col-span-2">
                  <input className={field} placeholder="Địa chỉ" value={form.hotel?.address || ""} onChange={(e) => setIn("hotel", "address", e.target.value)} />
                </div>
                <input className={field} placeholder="Giờ trả phòng" value={form.hotel?.checkout || ""} onChange={(e) => setIn("hotel", "checkout", e.target.value)} />
                <div className="sm:col-span-3">
                  <label className={labelText}>Tiện nghi (mỗi dòng một ý)</label>
                  <textarea rows={2} className={area} value={toLines(form.hotel?.amenities)} onChange={(e) => setList("hotel", "amenities", e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <input className={field} placeholder="Chính sách hủy" value={form.hotel?.cancel_policy || ""} onChange={(e) => setIn("hotel", "cancel_policy", e.target.value)} />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Loại phòng</span>
                  <button
                    type="button"
                    onClick={() => setIn("hotel", "room_types", [...(form.hotel?.room_types || []), { name: "", price_per_night: 0, max_guests: 2, breakfast: true }])}
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand"
                  >
                    <Plus className="h-3 w-3" /> Thêm loại phòng
                  </button>
                </div>
                {(form.hotel?.room_types || []).map((room, index) => {
                  const next = [...form.hotel.room_types];
                  const patch = (key, value) => {
                    next[index] = { ...room, [key]: key === "breakfast" ? value : key === "name" ? value : Number(value) || 0 };
                    setIn("hotel", "room_types", next);
                  };
                  return (
                    <div key={index} className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                      <input className={field} placeholder="Tên loại phòng" value={room.name || ""} onChange={(e) => patch("name", e.target.value)} />
                      <input type="number" className={field} placeholder="Giá / đêm" value={room.price_per_night ?? ""} onChange={(e) => patch("price_per_night", e.target.value)} />
                      <input type="number" className={field} placeholder="Khách tối đa" value={room.max_guests ?? ""} onChange={(e) => patch("max_guests", e.target.value)} />
                      <label className="flex items-center gap-1.5 text-[11.5px] text-slate-600">
                        <input type="checkbox" checked={Boolean(room.breakfast)} onChange={(e) => patch("breakfast", e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand" />
                        Ăn sáng
                      </label>
                      <button
                        type="button"
                        onClick={() => setIn("hotel", "room_types", form.hotel.room_types.filter((_, i) => i !== index))}
                        className="grid h-9 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600"
                        aria-label="Xóa loại phòng"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {form.type === "Visa" ? (
            <section className="rounded-xl border border-slate-100 p-3">
              <h3 className={sectionTitle}>Chi tiết visa</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input className={field} placeholder="Quốc gia" value={form.visa?.country || ""} onChange={(e) => setIn("visa", "country", e.target.value)} />
                <select className={field} value={form.visa?.visa_type || "Du lịch"} onChange={(e) => setIn("visa", "visa_type", e.target.value)}>
                  {["Du lịch", "Công tác", "Thăm thân"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <input className={field} placeholder="Thời gian xử lý" value={form.visa?.processing_time || ""} onChange={(e) => setIn("visa", "processing_time", e.target.value)} />
                <input type="number" className={field} placeholder="Phí dịch vụ (VND)" value={form.visa?.service_fee ?? ""} onChange={(e) => setIn("visa", "service_fee", e.target.value)} />
                <input type="number" className={field} placeholder="Phí lãnh sự (VND)" value={form.visa?.consular_fee ?? ""} onChange={(e) => setIn("visa", "consular_fee", e.target.value)} />
                <input className={field} placeholder="Hình thức nộp" value={form.visa?.submission || ""} onChange={(e) => setIn("visa", "submission", e.target.value)} />
                <div className="sm:col-span-3">
                  <label className={labelText}>Hồ sơ cần chuẩn bị (mỗi dòng một ý)</label>
                  <textarea rows={3} className={area} value={toLines(form.visa?.documents)} onChange={(e) => setList("visa", "documents", e.target.value)} />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelText}>Lưu ý</label>
                  <textarea rows={2} className={area} value={form.visa?.notes || ""} onChange={(e) => setIn("visa", "notes", e.target.value)} />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Không cam kết tỷ lệ đậu visa trên website.</p>
            </section>
          ) : null}

          {form.type === "Đưa đón" || form.type === "Khác" ? (
            <section className="rounded-xl border border-slate-100 p-3">
              <h3 className={sectionTitle}>Chi tiết đưa đón / khác</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <input className={field} placeholder="Loại xe" value={form.transport?.vehicle_type || ""} onChange={(e) => setIn("transport", "vehicle_type", e.target.value)} />
                <input type="number" className={field} placeholder="Số chỗ" value={form.transport?.seats ?? ""} onChange={(e) => setIn("transport", "seats", e.target.value)} />
                <input className={field} placeholder="Quãng đường / khu vực" value={form.transport?.route_area || ""} onChange={(e) => setIn("transport", "route_area", e.target.value)} />
                <input type="number" className={field} placeholder="Giá theo chặng" value={form.transport?.price_per_leg ?? ""} onChange={(e) => setIn("transport", "price_per_leg", e.target.value)} />
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-100 p-3">
            <h3 className={sectionTitle}>SEO</h3>
            <div className="mt-2 space-y-2">
              <input className={field} placeholder="Meta title" value={form.seo_title || ""} onChange={(e) => set("seo_title", e.target.value)} />
              <textarea rows={2} className={area} placeholder="Meta description" value={form.seo_description || ""} onChange={(e) => set("seo_description", e.target.value)} />
            </div>
          </section>
        </div>

        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="h-10 rounded-xl border border-slate-200 px-4 text-[13px] font-semibold text-slate-600">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-5 text-[13px] font-semibold text-white disabled:opacity-70"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {service ? "Lưu thay đổi" : "Tạo dịch vụ"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}