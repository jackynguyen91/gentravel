import { paidOf } from "@/lib/booking-status";
import { costLineTotal } from "@/lib/tour-profit";
import { paxOf } from "@/lib/departure-seats";
import { dueDateOf } from "@/lib/setting-defaults";

const CLOSED = ["Đã hủy", "Hoàn tiền"];

export const METHOD_STYLE = {
  "Chuyển khoản": "border-sky-200 bg-sky-50 text-sky-700",
  "VNPay": "border-indigo-200 bg-indigo-50 text-indigo-700",
  "MoMo": "border-pink-200 bg-pink-50 text-pink-700",
  "Tiền mặt": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "VietQR": "border-blue-200 bg-blue-50 text-blue-700",
  "Thẻ tín dụng": "border-purple-200 bg-purple-50 text-purple-700",
  "Đại lý thu": "border-amber-200 bg-amber-50 text-amber-700",
  "Chưa rõ (dữ liệu cũ)": "border-slate-200 bg-slate-100 text-slate-600",
};

export const PAYMENT_STATUS_STYLE = {
  "Đã thanh toán": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Chờ xử lý": "border-amber-200 bg-amber-50 text-amber-700",
  "Chờ duyệt hoàn": "border-amber-200 bg-amber-50 text-amber-700",
  "Thất bại": "border-red-200 bg-red-50 text-red-700",
  "Đã hoàn tiền": "border-slate-200 bg-slate-100 text-slate-600",
};

export const RECEIVED = "Đã thanh toán";
export const REFUND_KIND = "Hoàn tiền";
export const REFUND_PENDING = "Chờ duyệt hoàn";

/** Nhãn trạng thái thanh toán của đơn, tự tính từ sổ giao dịch. */
export const BOOKING_PAYMENT_STATUS = {
  "Chưa thanh toán": "border-yellow-200 bg-yellow-50 text-yellow-800",
  "Đã đặt cọc": "border-blue-200 bg-blue-50 text-blue-700",
  "Đã thanh toán": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Đã hoàn tiền": "border-slate-200 bg-slate-100 text-slate-600",
};

export const isOutgoing = (row) => row?.direction === "Chi đối tác";
export const isRefund = (row) => row?.kind === REFUND_KIND || Number(row?.amount) < 0;

/** Giao dịch thực thu của khách (đã xác nhận, không phải chi đối tác, không phải hoàn tiền). */
export function isCashIn(row) {
  return !isOutgoing(row) && !isRefund(row) && row?.status === RECEIVED;
}

/** Hoàn tiền đã chi thực tế cho khách. */
export function isRefundPaid(row) {
  return isRefund(row) && Number(row?.amount) < 0 && ["Đã hoàn tiền", RECEIVED].includes(row?.status);
}

const dateKey = (row) => String(row?.paid_at || row?.created_date || "").slice(0, 10);

/** Thực thu trong khoảng: tổng thu đã xác nhận trừ hoàn tiền đã chi. */
export function cashIn(payments, from, to) {
  const inRange = payments.filter((row) => {
    if (!from && !to) return true;
    const date = dateKey(row);
    return (!from || date >= from) && (!to || date <= to);
  });
  const gross = inRange.filter(isCashIn).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const refunds = inRange.filter(isRefundPaid).reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0);
  return { gross, refunds, net: gross - refunds };
}

/** Tổng tiền đã thực thu của một đơn (ưu tiên sổ giao dịch, sau đó tới paid_amount của đơn). */
export function bookingCash(booking, payments) {
  const rows = payments.filter((row) => !isOutgoing(row) && row.booking_code === booking.booking_code);
  const received = rows.filter(isCashIn).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const refunded = rows.filter(isRefundPaid).reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0);
  const fromLedger = received - refunded;
  if (received > 0 || refunded > 0) return { received, refunded, net: fromLedger };
  const legacy = paidOf(booking);
  return { received: legacy, refunded: 0, net: legacy };
}

export function receivedForBooking(booking, payments) {
  return bookingCash(booking, payments).net;
}

/** Trạng thái thanh toán tự tính của đơn. */
export function bookingPaymentStatus(booking, payments) {
  const total = Number(booking.total_price) || 0;
  const { received, refunded, net } = bookingCash(booking, payments);
  if (booking.status === "Hoàn tiền") return "Đã hoàn tiền";
  if (refunded > 0 && net <= 0) return "Đã hoàn tiền";
  if (total > 0 && net >= total - 1) return "Đã thanh toán";
  if (net > 0) return "Đã đặt cọc";
  return "Chưa thanh toán";
}

/** Tuổi nợ của một khoản phải thu. */
export function agingOf(dueDate) {
  const due = String(dueDate || "").slice(0, 10);
  if (!due) return "0–7";
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(`${due}T00:00:00`).getTime()) / 86400000);
  if (days <= 7) return "0–7";
  if (days <= 30) return "8–30";
  return ">30";
}

export function receivablesOf(bookings, payments, dueDays = 7) {
  const today = new Date().toISOString().slice(0, 10);
  return bookings
    .filter((booking) => !CLOSED.includes(booking.status))
    .map((booking) => {
      const total = Number(booking.total_price) || 0;
      const paid = receivedForBooking(booking, payments);
      const due_date = dueDateOf(booking, dueDays);
      return {
        booking,
        total,
        paid,
        remaining: Math.max(total - paid, 0),
        due_date,
        overdue: Boolean(due_date && due_date < today),
        aging: agingOf(due_date),
        status: bookingPaymentStatus(booking, payments),
      };
    })
    .filter((row) => row.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);
}

/** Công nợ phải trả đối tác = chi phí tour đã ghi nhận − đã chi. */
export function payablesOf({ partners, tours, costs, bookings, payments }) {
  const tourById = new Map(tours.map((tour) => [tour.id, tour]));
  const costByPartner = new Map();

  costs.forEach((cost) => {
    if (!cost.partner_id) return;
    const tour = tourById.get(cost.tour_id);
    const pax = bookings
      .filter((booking) => booking.tour_id === cost.tour_id && !CLOSED.includes(booking.status))
      .reduce((sum, booking) => sum + paxOf(booking), 0);
    costByPartner.set(cost.partner_id, (costByPartner.get(cost.partner_id) || 0) + costLineTotal(cost, pax || 1));
  });

  return partners
    .map((partner) => {
      const cost = costByPartner.get(partner.id) || 0;
      const paid = payments
        .filter((row) => row.direction === "Chi đối tác" && row.partner_id === partner.id && row.status === RECEIVED)
        .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      const pending = payments
        .filter((row) => row.direction === "Chi đối tác" && row.partner_id === partner.id && row.status === "Chờ xử lý")
        .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
      return { partner, cost, paid, pending, remaining: Math.max(cost - paid - pending, 0) };
    })
    .filter((row) => row.cost > 0)
    .sort((a, b) => b.remaining - a.remaining);
}

/** Số tiền hoàn theo chính sách hủy của tour (tính trên phần đã thu). */
export function refundFor(policy, departureDate, paidAmount) {
  const paid = Math.max(Number(paidAmount) || 0, 0);
  if (!paid) return { amount: 0, feePercent: 0 };
  const rules = [...(policy || [])]
    .filter((rule) => Number.isFinite(Number(rule?.days_before)))
    .sort((a, b) => Number(b.days_before) - Number(a.days_before));
  if (!rules.length) return { amount: paid, feePercent: 0 };
  const departure = String(departureDate || "").slice(0, 10);
  const daysLeft = departure
    ? Math.floor((new Date(`${departure}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : 0;
  const matched = rules.find((rule) => daysLeft >= Number(rule.days_before)) || rules[rules.length - 1];
  const feePercent = Math.min(Math.max(Number(matched.fee_percent) || 0, 0), 100);
  return { amount: Math.round((paid * (100 - feePercent)) / 100), feePercent };
}