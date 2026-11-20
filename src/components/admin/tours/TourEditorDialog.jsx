import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { slugify } from "@/lib/slugify";
import { buildTourChecklist } from "@/lib/tour-checklist";
import BasicsTab from "@/components/admin/tours/BasicsTab";
import PricingTab from "@/components/admin/tours/PricingTab";
import ItineraryTab from "@/components/admin/tours/ItineraryTab";
import DeparturesTab from "@/components/admin/tours/DeparturesTab";
import MediaTab from "@/components/admin/tours/MediaTab";
import PolicyTab from "@/components/admin/tours/PolicyTab";
import SeoTab from "@/components/admin/tours/SeoTab";
import TourChecklistBar from "@/components/admin/tours/TourChecklistBar";

const TABS = [
  { key: "basics", label: "Thông tin" },
  { key: "pricing", label: "Giá & phụ thu" },
  { key: "itinerary", label: "Lịch trình" },
  { key: "departures", label: "Khởi hành" },
  { key: "media", label: "Hình ảnh" },
  { key: "policy", label: "Bao gồm & hủy" },
  { key: "seo", label: "SEO" },
];

const emptyForm = () => ({
  title: "",
  slug: "",
  destination: "",
  region: "Miền Bắc",
  area: "",
  scope: "domestic",
  category: "Tour trong nước",
  duration_days: 3,
  duration_nights: 2,
  price_adult: 0,
  price_child: 0,
  price_infant: 0,
  cost_adult: 0,
  cost_child: 0,
  cost_infant: 0,
  discount_percent: 0,
  discount_from: "",
  discount_to: "",
  tour_code: "",
  theme_tags: [],
  min_pax: 2,
  max_pax: 30,
  price_single_supplement: 0,
  surcharge_periods: [],
  required_documents: [],
  archived: false,
  status: "Nháp",
  departure_point: "Hà Nội",
  departure_dates: [],
  seats_total: 20,
  surcharges: [],
  cancellation_policy: [],
  seo_title: "",
  seo_description: "",
  seo_keywords: "",
  cover_image: "",
  gallery_images: [],
  itinerary_images: [],
  highlights: [],
  short_description: "",
  route: [{ day: 1, title: "", description: "", image: "", transport: "", meals: [], hotel: "" }],
  included_services: [],
  excluded_services: [],
  notes: [],
  notes_groups: [],
  suitable_for: [],
  child_age_from: 2,
  child_age_to: 11,
  infant_age_max: 2,
  child_note: "",
  infant_price_note: "",
  is_featured: false,
  rating: 4.8,
  review_count: 0,
  rating_visible: true,
  view_count: 0,
});

const buildForm = (source) => ({
  ...emptyForm(),
  ...source,
  surcharges: source.surcharges || [],
  cancellation_policy: source.cancellation_policy || [],
  gallery_images: source.gallery_images || [],
  itinerary_images: source.itinerary_images || [],
  highlights: source.highlights || [],
  included_services: source.included_services || [],
  excluded_services: source.excluded_services || [],
  notes: source.notes || [],
  notes_groups: source.notes_groups || [],
  suitable_for: source.suitable_for || [],
  departure_dates: source.departure_dates || [],
  route: source.route?.length
    ? source.route
    : [{ day: 1, title: "", description: "", image: "", transport: "", meals: [], hotel: "" }],
  theme_tags: source.theme_tags || [],
  surcharge_periods: source.surcharge_periods || [],
  required_documents: source.required_documents || [],
  status: source.status || "Đang bán",
});

export default function TourEditorDialog({ open, onOpenChange, tour, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [tab, setTab] = useState("basics");
  const [saving, setSaving] = useState(false);
  const [loadingTour, setLoadingTour] = useState(false);
  const [error, setError] = useState("");
  const [departuresCount, setDeparturesCount] = useState(0);
  const isEdit = Boolean(tour?.id);

  useEffect(() => {
    if (!open) return;
    setTab("basics");
    setError("");
    setDeparturesCount(0);
    if (!tour?.id) {
      setForm(emptyForm());
      return;
    }

    // Danh sách quản trị chỉ trả về bản rút gọn — luôn nạp bản đầy đủ trước khi sửa.
    let alive = true;
    setLoadingTour(true);
    base44.entities.Tour.get(tour.id)
      .then((full) => {
        if (alive) setForm(buildForm(full || tour));
      })
      .catch(() => {
        if (alive) setForm(buildForm(tour));
      })
      .finally(() => {
        if (alive) setLoadingTour(false);
      });

    return () => {
      alive = false;
    };
  }, [open, tour?.id]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const generateSeo = () => {
    const days = Number(form.duration_days) || 1;
    const nights = Number(form.duration_nights) || 0;
    setForm((prev) => ({
      ...prev,
      seo_title: `${prev.title} ${days} ngày ${nights} đêm | GenTravel`.slice(0, 60),
      seo_description: `Đặt tour ${prev.title.toLowerCase()} tại GenTravel: lịch trình ${days} ngày ${nights} đêm chi tiết, giá minh bạch, khởi hành ${prev.departure_point}. Hỗ trợ 24/7, xác nhận nhanh.`.slice(0, 160),
      seo_keywords: `${prev.title.toLowerCase()}, tour ${(prev.destination || "").toLowerCase()}, tour ${days} ngày ${nights} đêm`,
    }));
  };

  const handleSave = async () => {
    if (loadingTour) {
      setError("Đang tải dữ liệu tour, vui lòng chờ một chút.");
      return;
    }
    if (!form.title.trim() || !form.destination.trim()) {
      setTab("basics");
      setError("Vui lòng nhập tên tour và điểm đến.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        slug: (form.slug.trim() || slugify(form.title)).toLowerCase(),
        destination: form.destination.trim(),
        region: form.region,
        area: form.area || "",
        scope: form.scope,
        category: form.category,
        short_description: (form.short_description || "").trim(),
        duration_days: Number(form.duration_days) || 1,
        duration_nights: Number(form.duration_nights) || 0,
        price_adult: Number(form.price_adult) || 0,
        price_child: Number(form.price_child) || 0,
        price_infant: Number(form.price_infant) || 0,
        cost_adult: Number(form.cost_adult) || 0,
        cost_child: Number(form.cost_child) || 0,
        cost_infant: Number(form.cost_infant) || 0,
        discount_percent: Number(form.discount_percent) || 0,
        discount_from: form.discount_from || "",
        discount_to: form.discount_to || "",
        original_price: Number(form.original_price) || Number(form.price_adult) || 0,
        tour_code: (form.tour_code || "").trim(),
        theme_tags: (form.theme_tags || []).filter((item) => String(item).trim()),
        min_pax: Number(form.min_pax) || 0,
        max_pax: Number(form.max_pax) || 0,
        price_single_supplement: Number(form.price_single_supplement) || 0,
        child_age_from: Number(form.child_age_from) || 0,
        child_age_to: Number(form.child_age_to) || 0,
        infant_age_max: Number(form.infant_age_max) || 0,
        child_note: (form.child_note || "").trim(),
        infant_price_note: (form.infant_price_note || "").trim(),
        surcharge_periods: (form.surcharge_periods || [])
          .filter((row) => row.label?.trim())
          .map((row) => ({
            label: row.label.trim(),
            from_date: row.from_date || "",
            to_date: row.to_date || "",
            amount: Number(row.amount) || 0,
            unit: row.unit || "Mỗi khách",
          })),
        required_documents: (form.required_documents || []).filter((item) => String(item).trim()),
        status: form.status,
        departure_point: (form.departure_point || "").trim(),
        departure_dates: (form.departure_dates || []).filter(Boolean),
        seats_total: Number(form.seats_total) || 0,
        surcharges: form.surcharges
          .filter((row) => row.label?.trim())
          .map((row) => ({ label: row.label.trim(), amount: Number(row.amount) || 0, unit: row.unit })),
        cancellation_policy: form.cancellation_policy.map((row) => ({
          days_before: Number(row.days_before) || 0,
          fee_percent: Number(row.fee_percent) || 0,
          note: (row.note || "").trim(),
        })),
        seo_title: form.seo_title.trim(),
        seo_description: form.seo_description.trim(),
        seo_keywords: form.seo_keywords.trim(),
        cover_image: form.cover_image.trim(),
        gallery_images: form.gallery_images.filter((url) => url.trim()),
        itinerary_images: form.itinerary_images.filter((url) => url.trim()).slice(0, 6),
        highlights: (form.highlights || []).filter((item) => String(item).trim()),
        included_services: (form.included_services || []).filter((item) => String(item).trim()),
        excluded_services: (form.excluded_services || []).filter((item) => String(item).trim()),
        suitable_for: (form.suitable_for || []).filter((item) => String(item).trim()),
        notes_groups: (form.notes_groups || [])
          .map((row) => ({ group: row.group, items: (row.items || []).filter((item) => String(item).trim()) }))
          .filter((row) => row.items.length),
        notes: (form.notes || []).filter((item) => String(item).trim()),
        route: form.route
          .filter((day) => day.title?.trim())
          .map((day, index) => ({
            day: index + 1,
            title: day.title.trim(),
            description: (day.description || "").trim(),
            image: (day.image || "").trim(),
            transport: (day.transport || "").trim(),
            meals: (day.meals || []).filter(Boolean),
            hotel: (day.hotel || "").trim(),
          })),
        is_featured: Boolean(form.is_featured),
        rating: Number(form.rating) || 0,
        review_count: Number(form.review_count) || 0,
        rating_visible: form.rating_visible !== false,
        view_count: Number(form.view_count) || 0,
      };

      if (isEdit) {
        await base44.entities.Tour.update(tour.id, payload);
      } else {
        await base44.entities.Tour.create(payload);
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError("Chưa lưu được tour. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setSaving(false);
    }
  };

  const checklist = buildTourChecklist(form, departuresCount);
  const missing = checklist.filter((item) => !item.ok);
  const previewSlug = (form.slug || "").trim();
  const canPreview = isEdit && previewSlug;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] w-[calc(100vw-2rem)] max-w-4xl overflow-hidden p-0">
        <div className="flex flex-col max-h-[94vh]">
          <div className="border-b border-slate-100 px-5 pt-5">
            <DialogTitle className="font-heading text-lg font-extrabold text-ink">
              {isEdit ? `Sửa tour · ${tour.title}` : "Thêm tour mới"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[12.5px] text-slate-500">
              {isEdit ? "Cập nhật thông tin, giá, lịch trình, ngày khởi hành, hình ảnh, chính sách và SEO." : "Tạo tour mới với đầy đủ giá bán, lịch trình, hình ảnh và SEO."}
            </DialogDescription>
            <div className="mt-3 flex gap-1 overflow-x-auto no-scrollbar">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`shrink-0 rounded-t-lg px-3 py-2 text-[12.5px] font-semibold transition ${
                    tab === item.key ? "bg-brand-50 text-brand" : "text-slate-500 hover:text-ink"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-cloud/60 px-5 py-4">
            {loadingTour ? (
              <p className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-6 text-[12.5px] font-medium text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tải dữ liệu tour…
              </p>
            ) : null}
            {!loadingTour && tab === "basics" && <BasicsTab form={form} set={set} />}
            {tab === "pricing" && <PricingTab form={form} set={set} />}
            {tab === "itinerary" && <ItineraryTab form={form} set={set} />}
            {tab === "departures" && <DeparturesTab form={form} tourId={tour?.id} onCount={setDeparturesCount} />}
            {tab === "media" && <MediaTab form={form} set={set} />}
            {tab === "policy" && <PolicyTab form={form} set={set} />}
            {tab === "seo" && <SeoTab form={form} set={set} onGenerate={generateSeo} />}
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">{error}</p>}
          </div>

          <div className="border-t border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Hoàn thiện</span>
              <TourChecklistBar items={checklist} activeTab={tab} onJump={setTab} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`text-[11.5px] ${missing.length ? "text-amber-700" : "text-emerald-700"}`}>
                {form.status} · {missing.length ? `còn ${missing.length} mục cần bổ sung` : "đủ mục cơ bản"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canPreview}
                  onClick={() => window.open(`/tours/${previewSlug}`, "_blank", "noopener")}
                  title={canPreview ? "Mở trang tour trên tab mới" : "Lưu tour trước khi xem trước"}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[12.5px] font-semibold text-slate-600 disabled:opacity-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Xem trước
                </button>
                <button type="button" onClick={() => onOpenChange(false)} className="h-10 rounded-xl border border-slate-200 px-4 text-[13px] font-semibold text-slate-600">
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || loadingTour}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-5 text-[13px] font-semibold text-white disabled:opacity-70"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isEdit ? "Lưu thay đổi" : "Tạo tour"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}