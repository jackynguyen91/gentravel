import DestinationSelect from "@/components/admin/tours/DestinationSelect";
import { Labelled, Section, area, field, labelText } from "@/components/admin/tours/form-parts";
import { TOUR_STATUSES } from "@/lib/tour-status";
import { slugify } from "@/lib/slugify";
import { THEME_TAGS, TOUR_SCOPES } from "@/lib/tour-catalog";
import { AREAS, REGIONS, SUITABLE_FOR } from "@/lib/tour-options";
import { DEPARTURE_OPTIONS } from "@/lib/departure";

const CATEGORIES = ["Tour trong nước", "Tour quốc tế", "Nghỉ dưỡng", "Khám phá"];

export default function BasicsTab({ form, set }) {
  const tags = form.theme_tags || [];
  const suitable = form.suitable_for || [];
  const isInternational = form.scope === "international";

  const toggleTag = (tag) => set("theme_tags", tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]);
  const toggleSuitable = (item) => set("suitable_for", suitable.includes(item) ? suitable.filter((row) => row !== item) : [...suitable, item]);

  return (
    <div className="space-y-3">
      <Section title="Thông tin chung">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled label="Tên tour" span>
            <input className={field} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Phú Quốc – Thiên đường nắng vàng" />
          </Labelled>
          <Labelled label="Mã tour">
            <input className={`${field} tnum`} value={form.tour_code || ""} onChange={(e) => set("tour_code", e.target.value)} placeholder="TOUR-001" />
          </Labelled>
          <Labelled label="Đường dẫn (slug)">
            <div className="flex gap-2">
              <input className={field} value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="tu-dong-tao" />
              <button
                type="button"
                onClick={() => set("slug", slugify(form.title))}
                className="shrink-0 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-500 hover:text-brand"
              >
                Tạo
              </button>
            </div>
          </Labelled>
          <Labelled label="Điểm đến">
            <DestinationSelect value={form.destination} onChange={(value) => set("destination", value)} />
          </Labelled>
          <Labelled label="Điểm khởi hành" hint="Khớp bộ chọn điểm khởi hành trên menu website.">
            <select className={field} value={form.departure_point || ""} onChange={(e) => set("departure_point", e.target.value)}>
              <option value="">Chọn điểm khởi hành</option>
              {DEPARTURE_OPTIONS.filter((item) => item !== "Khác").map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              {form.departure_point && !DEPARTURE_OPTIONS.includes(form.departure_point) ? (
                <option value={form.departure_point}>{form.departure_point} (chưa khớp menu)</option>
              ) : null}
            </select>
          </Labelled>
          <Labelled label="Phạm vi">
            <select className={field} value={form.scope} onChange={(e) => set("scope", e.target.value)}>
              {TOUR_SCOPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Labelled>
          {isInternational ? (
            <Labelled label="Khu vực">
              <select className={field} value={form.area || ""} onChange={(e) => set("area", e.target.value)}>
                <option value="">Chọn khu vực</option>
                {AREAS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Labelled>
          ) : (
            <Labelled label="Vùng miền">
              <select className={field} value={form.region || ""} onChange={(e) => set("region", e.target.value)}>
                {REGIONS.filter((item) => item !== "Quốc tế").map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Labelled>
          )}
          <Labelled label="Mô tả ngắn" span>
            <textarea
              rows={2}
              className={area}
              value={form.short_description || ""}
              onChange={(e) => set("short_description", e.target.value)}
              placeholder="Một hai câu giới thiệu hiện dưới tiêu đề tour trên trang khách."
            />
          </Labelled>
        </div>
        {isInternational && form.region ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] font-medium text-amber-800">
            Tour quốc tế đang giữ giá trị Vùng miền cũ: “{form.region}”. Dữ liệu cũ được giữ nguyên, trang khách không hiện mục này.
          </p>
        ) : null}
      </Section>

      <Section title="Phù hợp với" hint="Chọn nhiều nhóm khách — hiện thành dòng “Phù hợp: …” dưới tiêu đề tour.">
        <div className="flex flex-wrap gap-1.5">
          {SUITABLE_FOR.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => toggleSuitable(item)}
              className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                suitable.includes(item) ? "bg-brand text-white" : "bg-cloud text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Phân loại & trạng thái">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled label="Danh mục">
            <select className={field} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Labelled>
          <Labelled label="Trạng thái bán">
            <select className={field} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {TOUR_STATUSES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Labelled>
          <Labelled label="Thời lượng">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                <input type="number" min={1} className={field} value={form.duration_days} onChange={(e) => set("duration_days", e.target.value)} />
                <span className="text-[11.5px] text-slate-500">ngày</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} className={field} value={form.duration_nights} onChange={(e) => set("duration_nights", e.target.value)} />
                <span className="text-[11.5px] text-slate-500">đêm</span>
              </div>
            </div>
          </Labelled>
          <Labelled label="Số khách tối thiểu">
            <input type="number" min={1} className={field} value={form.min_pax ?? 2} onChange={(e) => set("min_pax", e.target.value)} />
          </Labelled>
          <Labelled label="Số khách tối đa mỗi chuyến">
            <input type="number" min={1} className={field} value={form.max_pax ?? form.seats_total} onChange={(e) => set("max_pax", e.target.value)} />
          </Labelled>
        </div>
        <div className="mt-3">
          <label className={labelText}>Chủ đề / tag</label>
          <div className="flex flex-wrap gap-1.5">
            {THEME_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                  tags.includes(tag) ? "bg-brand text-white" : "bg-cloud text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-[13px] font-medium text-slate-600">
          <input
            type="checkbox"
            checked={Boolean(form.is_featured)}
            onChange={(e) => set("is_featured", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          Tour nổi bật trên trang chủ
        </label>
      </Section>

      <Section title="Đánh giá hiển thị" hint="Số nhập tay (chưa nối hệ thống đánh giá thật). Tắt công tắc để ẩn điểm sao trên trang khách.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Labelled label="Điểm sao">
            <input type="number" min={0} max={5} step={0.1} className={field} value={form.rating ?? 0} onChange={(e) => set("rating", e.target.value)} />
          </Labelled>
          <Labelled label="Số đánh giá">
            <input type="number" min={0} className={`${field} tnum`} value={form.review_count ?? 0} onChange={(e) => set("review_count", e.target.value)} />
          </Labelled>
          <label className="flex items-end gap-2 pb-2 text-[12.5px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={form.rating_visible !== false}
              onChange={(e) => set("rating_visible", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Hiện trên trang khách
          </label>
        </div>
      </Section>
    </div>
  );
}