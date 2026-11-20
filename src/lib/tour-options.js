// Nhãn & lựa chọn dùng chung cho form tour và trang khách.
export const AREAS = ["Đông Bắc Á", "Đông Nam Á", "Châu Âu", "Châu Mỹ", "Châu Úc", "Trung Đông"];

export const REGIONS = ["Miền Bắc", "Miền Trung", "Miền Nam", "Quốc tế"];

export const SUITABLE_FOR = ["Gia đình", "Cặp đôi", "Nhóm bạn", "Một mình", "Người cao tuổi", "Công ty"];

export const NOTE_GROUPS = ["Giấy tờ và visa", "Hành lý", "Trẻ em", "Thời tiết và trang phục", "Khác"];

export const DEPARTURE_STATUSES = ["Mở bán", "Sắp đầy", "Đã đầy", "Đóng"];

// % giá trẻ em tự tính — không nhập tay.
export function childPercent(tour) {
  const adult = Number(tour?.price_adult) || 0;
  const child = Number(tour?.price_child) || 0;
  if (!adult || !child) return 0;
  return Math.round((child / adult) * 100);
}

// Chú thích giá trẻ em trên trang khách, sinh từ các ô tuổi / ghi chú / giá.
export function childPriceNote(tour) {
  const hasParts = tour?.child_age_from != null || tour?.child_age_to != null || tour?.child_note || tour?.infant_price_note;
  if (!hasParts) return tour?.child_price_note || "";

  const from = Number(tour.child_age_from ?? 2);
  const to = Number(tour.child_age_to ?? 11);
  const infantMax = Number(tour.infant_age_max ?? 2);
  const pct = childPercent(tour);
  const adultSuffix = (tour.child_note || "").trim();
  const infantPart =
    (tour.infant_price_note || "").trim() ||
    `${(Number(tour.price_infant) || 0).toLocaleString("vi-VN")}₫/khách`;

  return `Trẻ em ${from} – ${to} tuổi${pct ? `: ${pct}% giá người lớn` : ""}${adultSuffix ? `, ${adultSuffix}` : ""}. Trẻ dưới ${infantMax} tuổi: ${infantPart}.`;
}