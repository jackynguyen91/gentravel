import { REFUND_KIND, REFUND_PENDING, receivedForBooking, refundFor } from "@/lib/payment-utils";
import { mergeSettings } from "@/lib/setting-defaults";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));

/**
 * Tạo yêu cầu hoàn tiền (số âm) khi hủy đơn đã thu tiền.
 * Số tiền hoàn theo chính sách hủy của tour, nếu tour không có thì dùng chính sách mặc định trong Cài đặt.
 * Giao dịch ở trạng thái "Chờ duyệt hoàn" — Quản lý duyệt mới ghi nhận là đã hoàn.
 */
export async function createRefundFor(base44, booking, reason = "") {
  const payments = asArray(await base44.entities.Payment.filter({ booking_code: booking.booking_code }, { limit: 100 }));
  const duplicated = payments.some(
    (row) => row.kind === REFUND_KIND && [REFUND_PENDING, "Đã hoàn tiền"].includes(row.status),
  );
  if (duplicated) return null;

  const paid = receivedForBooking(booking, payments);
  if (paid <= 0) return null;

  const tour = await base44.entities.Tour.get(booking.tour_id).catch(() => null);
  let policy = tour?.cancellation_policy || [];
  if (!policy.length) {
    const settingsRow = asArray(await base44.entities.Setting.list({ limit: 1 }))[0];
    policy = mergeSettings(settingsRow).default_cancellation;
  }

  const { amount, feePercent } = refundFor(policy, booking.departure_date, paid);
  if (amount <= 0) return null;

  await base44.entities.Payment.create({
    direction: "Thu từ khách",
    booking_code: booking.booking_code,
    booking_id: booking.id,
    tour_id: booking.tour_id,
    customer_name: booking.customer_name,
    amount: -amount,
    kind: REFUND_KIND,
    method: "Chuyển khoản",
    status: REFUND_PENDING,
    note: `Hoàn ${100 - feePercent}% trên ${paid.toLocaleString("vi-VN")}₫ đã thu · phí hủy ${feePercent}%${reason ? ` · ${reason}` : ""}`,
  });

  return { amount, feePercent, paid };
}