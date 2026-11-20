import { formatVND } from "@/lib/format";

export const SERVICE_STATUSES = ["Đang hiển thị", "Ẩn", "Nháp", "Tạm ngưng/Hết hàng"];
export const SERVICE_STATUS_STYLE = {
  "Đang hiển thị": "bg-emerald-50 text-emerald-700",
  Ẩn: "bg-slate-100 text-slate-500",
  Nháp: "bg-amber-50 text-amber-700",
  "Tạm ngưng/Hết hàng": "bg-red-50 text-red-600",
};

export const DEFAULT_SERVICE_TYPES = ["Vé máy bay", "Vé tham quan", "Khách sạn", "Visa", "Đưa đón", "Khác"];

export const PRICE_UNITS = ["vé", "đêm", "người", "hồ sơ", "lượt", "chặng", "phòng"];
export const PRICE_KINDS = [
  "Một chiều",
  "Khứ hồi",
  "Người lớn",
  "Trẻ em",
  "Phòng 2 khách",
  "Theo ngày",
];

export const SERVICE_REQUEST_STATUSES = [
  "Mới",
  "Đã liên hệ",
  "Đã báo giá",
  "Đã xác nhận",
  "Đã thanh toán",
  "Hoàn tất",
  "Hủy",
];
export const REQUEST_STATUS_STYLE = {
  Mới: "bg-amber-50 text-amber-700",
  "Đã liên hệ": "bg-sky-50 text-sky-700",
  "Đã báo giá": "bg-purple-50 text-purple-700",
  "Đã xác nhận": "bg-blue-50 text-blue-700",
  "Đã thanh toán": "bg-emerald-50 text-emerald-700",
  "Hoàn tất": "bg-emerald-50 text-emerald-700",
  Hủy: "bg-red-50 text-red-600",
};

export function servicePrice(service) {
  const value = Number(service?.price ?? service?.price_from ?? 0);
  return Number.isFinite(value) ? value : 0;
}

/** "890.000đ/vé · Giá một chiều, đã gồm thuế phí" */
export function servicePriceLabel(service) {
  const price = servicePrice(service);
  if (!price) return "Giá theo yêu cầu";
  const parts = [
    `${formatVND(price)}${service?.price_unit ? `/${service.price_unit}` : ""}`,
    service?.price_kind || "",
    service?.price_includes_tax === false ? "chưa gồm thuế phí" : "đã gồm thuế phí",
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Giá bán gợi ý từ giá nhập + markup + phí dịch vụ. */
export function suggestedPrice(service) {
  const cost = Number(service?.cost_price) || 0;
  if (!cost) return 0;
  const markup = Number(service?.markup_percent) || 0;
  return Math.round(cost * (1 + markup / 100) + (Number(service?.service_fee) || 0));
}

export function profitOf(service) {
  const cost = Number(service?.cost_price) || 0;
  if (!cost) return null;
  return servicePrice(service) - cost - (Number(service?.service_fee) || 0);
}

/** Tách câu giá cũ ("890.000đ/vé · Giá một chiều, đã gồm thuế phí"). */
export function parseLegacyPrice(service) {
  const rawPrice = service?.price ?? service?.price_from;
  const price = Number(rawPrice);
  const result = {
    price: Number.isFinite(price) && price > 0 ? price : 0,
    price_unit: service?.price_unit || "",
    price_kind: service?.price_kind || "",
    price_includes_tax: service?.price_includes_tax !== false,
    price_note: service?.price_note || "",
    price_needs_review: false,
  };
  if (Number.isFinite(price) && price > 0) {
    const text = `${service?.price_note || ""} ${service?.price_unit || ""}`.toLowerCase();
    if (!result.price_unit) {
      const unit = PRICE_UNITS.find((item) => text.includes(item));
      result.price_unit = unit || "vé";
    }
    if (!result.price_kind) {
      const kind = PRICE_KINDS.find((item) => text.includes(item.toLowerCase()));
      result.price_kind = kind || "";
    }
    const excludesTax = ["chưa gồm", "chưa bao gồm", "chưa thuế", "+ thuế"].some((needle) => text.includes(needle));
    if (excludesTax) result.price_includes_tax = false;
  } else if (!service?.price_note && typeof rawPrice === "string" && rawPrice.trim()) {
    // Giá cũ lưu bằng chữ: giữ nguyên trong ghi chú và gắn nhãn cần rà soát.
    result.price_note = rawPrice.trim();
    result.price_needs_review = true;
  }
  return result;
}