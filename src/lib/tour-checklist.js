// Checklist hoàn thiện tour — hiện ở thanh dưới form Sửa tour.
export function buildTourChecklist(form, departuresCount = 0) {
  const days = Number(form.duration_days) || 1;
  const routeDays = (form.route || []).filter((day) => (day.title || "").trim()).length;
  const noteItems = (form.notes_groups || []).reduce((sum, group) => sum + (group.items?.length || 0), 0);
  const hasNotes = noteItems > 0 || (form.notes || []).length > 0;

  return [
    {
      key: "info",
      tab: "basics",
      label: "Thông tin",
      ok: Boolean((form.title || "").trim() && (form.destination || "").trim() && (form.departure_point || "").trim()),
    },
    { key: "price", tab: "pricing", label: "Giá", ok: (Number(form.price_adult) || 0) > 0 },
    { key: "route", tab: "itinerary", label: `Lịch trình ${routeDays}/${days} ngày`, ok: routeDays >= days },
    { key: "highlights", tab: "itinerary", label: "Điểm nhấn", ok: (form.highlights || []).filter(Boolean).length > 0 },
    {
      key: "included",
      tab: "policy",
      label: "Bao gồm",
      ok: (form.included_services || []).filter(Boolean).length > 0 && (form.excluded_services || []).filter(Boolean).length > 0,
    },
    { key: "notes", tab: "policy", label: "Lưu ý", ok: hasNotes },
    {
      key: "departures",
      tab: "departures",
      label: "Khởi hành",
      ok: departuresCount > 0 || (form.departure_dates || []).length > 0,
    },
    { key: "media", tab: "media", label: "Hình ảnh", ok: Boolean((form.cover_image || "").trim()) },
    {
      key: "seo",
      tab: "seo",
      label: "SEO",
      ok: Boolean((form.seo_title || "").trim() && (form.seo_description || "").trim()),
    },
  ];
}