export const ROLES = ["Quản lý", "Điều hành", "Sales", "Kế toán", "Content"];

export const ROLE_STYLE = {
  Admin: "border-brand/30 bg-brand-50 text-brand",
  "Quản lý": "border-purple-200 bg-purple-50 text-purple-700",
  "Điều hành": "border-emerald-200 bg-emerald-50 text-emerald-700",
  Sales: "border-sky-200 bg-sky-50 text-sky-700",
  "Kế toán": "border-amber-200 bg-amber-50 text-amber-700",
  Content: "border-pink-200 bg-pink-50 text-pink-700",
};

/** Quyền theo vai trò. Admin giữ toàn quyền như cũ. */
const MATRIX = {
  Admin: ["*"],
  "Quản lý": [
    "dashboard",
    "reports",
    "bookings",
    "service_requests",
    "customers",
    "payments",
    "refunds",
    "promotions",
    "tours",
    "tours_edit",
    "departures",
    "services",
    "partners",
    "costs",
    "operations",
    "marketing",
    "seo",
    "staff",
    "settings",
    "activity",
    "approve_refund",
  ],
  "Điều hành": [
    "dashboard",
    "bookings",
    "service_requests",
    "customers",
    "tours",
    "tours_edit",
    "departures",
    "services",
    "partners",
    "costs",
    "operations",
    "activity",
  ],
  Sales: ["dashboard", "bookings", "service_requests", "customers", "tours", "departures", "promotions"],
  "Kế toán": [
    "dashboard",
    "reports",
    "bookings",
    "service_requests",
    "customers",
    "payments",
    "refunds",
    "costs",
    "partners",
    "activity",
  ],
  Content: ["tours", "tours_edit", "marketing", "seo", "services"],
};

export const ROLE_SUMMARY = {
  Admin: "Toàn quyền, kể cả phân quyền và cấu hình hệ thống.",
  "Quản lý": "Xem tất cả, báo cáo tài chính, duyệt hoàn tiền; không đổi phân quyền.",
  "Điều hành": "Tour, lịch khởi hành, đối tác, chi phí, hành khách; không xem báo cáo tài chính tổng.",
  Sales: "Tạo và xem đơn/khách của mình, xem tour và lịch; không thấy chi phí, lợi nhuận.",
  "Kế toán": "Thanh toán, công nợ, chi phí, báo cáo tài chính; xem đơn; không sửa tour.",
  Content: "Bài viết, mô tả/ảnh/SEO của tour; không xem đơn và doanh thu.",
};

export function roleOf(user) {
  if (!user) return "Sales";
  if (user.role === "admin") return "Admin";
  return user.vai_tro || user.staff_role || "Sales";
}

export function can(user, capability) {
  const role = roleOf(user);
  const allowed = MATRIX[role] || MATRIX.Sales;
  return allowed.includes("*") || allowed.includes(capability);
}

/** Trang quản trị tương ứng với từng quyền. */
export const NAV_CAPABILITY = {
  "/admin": "dashboard",
  "/admin/reports": "reports",
  "/admin/bookings": "bookings",
  "/admin/service-requests": "service_requests",
  "/admin/customers": "customers",
  "/admin/payments": "payments",
  "/admin/promotions": "promotions",
  "/admin/tours": "tours",
  "/admin/departures": "departures",
  "/admin/services": "services",
  "/admin/partners": "partners",
  "/admin/operations": "operations",
  "/admin/refunds": "refunds",
  "/admin/blog": "marketing",
  "/admin/media": "marketing",
  "/admin/reviews": "marketing",
  "/admin/seo": "seo",
  "/admin/staff": "staff",
  "/admin/settings": "settings",
  "/admin/activity": "activity",
};