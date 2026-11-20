export const DEFAULT_SETTINGS = {
  company_name: "GenTravel",
  tax_code: "",
  logo_url: "",
  address: "",
  hotline: "1900 6789",
  email: "",
  website: "",
  bank_id: "",
  bank_name: "",
  account_number: "",
  account_name: "",
  payment_due_days: 7,
  tier_loyal_min: 20000000,
  tier_vip_min: 80000000,
  default_cancellation: [
    { days_before: 15, fee_percent: 10, note: "Hủy trước 15 ngày" },
    { days_before: 7, fee_percent: 30, note: "Hủy trước 7 ngày" },
    { days_before: 3, fee_percent: 70, note: "Hủy trước 3 ngày" },
    { days_before: 0, fee_percent: 100, note: "Hủy trong vòng 48 giờ" },
  ],
  email_subject: "GenTravel xác nhận yêu cầu đặt tour",
  email_body:
    "Xin chào {customer_name},\n\nGenTravel đã nhận được yêu cầu đặt tour {tour_title}.\nMã đặt chỗ: {booking_code}\nNgày khởi hành: {departure_date}\nTạm tính: {total_price}\n\nChuyên viên GenTravel sẽ gọi xác nhận trong vòng 30 phút làm việc.",
  hide_sample_data: false,
  service_types: [
    { name: "Vé máy bay", active: true },
    { name: "Vé tham quan", active: true },
    { name: "Khách sạn", active: true },
    { name: "Visa", active: true },
    { name: "Đưa đón", active: true },
    { name: "Khác", active: true },
  ],
};

export function mergeSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  const merged = { ...DEFAULT_SETTINGS };
  Object.keys(DEFAULT_SETTINGS).forEach((key) => {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") merged[key] = value;
  });
  return merged;
}

/** Hạn thanh toán của một đơn: ngày khởi hành trừ số ngày cấu hình. */
export function dueDateOf(booking, dueDays = 7) {
  const base = String(booking?.departure_date || "").slice(0, 10);
  if (!base) return "";
  const date = new Date(`${base}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() - (Number(dueDays) || 0));
  return date.toISOString().slice(0, 10);
}