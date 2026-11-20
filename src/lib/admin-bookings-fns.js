import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BOOKING_STATUSES, paidOf } from "@/lib/booking-status";
import { nextBookingCode } from "@/lib/booking-code";
import { createRefundFor } from "@/lib/refund";
import { requireAdmin } from "@/lib/auth-middleware";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const num = (value) => Number(value) || 0;
const parse = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const bookingTime = (booking) => parse(booking.booking_date)?.getTime() || parse(booking.created_date)?.getTime() || 0;
const dayDiff = (value) => {
  const date = parse(value);
  if (!date) return null;
  const today = new Date();
  const a = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86400000);
};
const within = (value, from, to) => {
  const date = parse(value);
  if (!date) return !from && !to;
  if (from && date < new Date(`${from}T00:00:00`)) return false;
  if (to && date > new Date(`${to}T23:59:59`)) return false;
  return true;
};

const SORTERS = {
  newest: (a, b) => bookingTime(b) - bookingTime(a),
  oldest: (a, b) => bookingTime(a) - bookingTime(b),
  "code-asc": (a, b) => String(a.booking_code).localeCompare(String(b.booking_code), "vi"),
  "code-desc": (a, b) => String(b.booking_code).localeCompare(String(a.booking_code), "vi"),
  "customer-asc": (a, b) => String(a.customer_name || "").localeCompare(String(b.customer_name || ""), "vi"),
  "customer-desc": (a, b) => String(b.customer_name || "").localeCompare(String(a.customer_name || ""), "vi"),
  "tour-asc": (a, b) => String(a.tour_title || "").localeCompare(String(b.tour_title || ""), "vi"),
  "tour-desc": (a, b) => String(b.tour_title || "").localeCompare(String(a.tour_title || ""), "vi"),
  "total-desc": (a, b) => num(b.total_price) - num(a.total_price),
  "total-asc": (a, b) => num(a.total_price) - num(b.total_price),
  "paid-desc": (a, b) => paidOf(b) - paidOf(a),
  "paid-asc": (a, b) => paidOf(a) - paidOf(b),
  "pax-asc": (a, b) => num(a.adults_count) + num(a.children_count) - (num(b.adults_count) + num(b.children_count)),
  "pax-desc": (a, b) => num(b.adults_count) + num(b.children_count) - (num(a.adults_count) + num(a.children_count)),
  "departure-asc": (a, b) => (parse(a.departure_date)?.getTime() || 0) - (parse(b.departure_date)?.getTime() || 0),
  "departure-desc": (a, b) => (parse(b.departure_date)?.getTime() || 0) - (parse(a.departure_date)?.getTime() || 0),
  "status-asc": (a, b) => String(a.status || "").localeCompare(String(b.status || ""), "vi"),
  "payment-asc": (a, b) => String(a.payment_status || "").localeCompare(String(b.payment_status || ""), "vi"),
};

const compact = (booking, departureCityById = new Map()) => ({
  id: booking.id,
  code: booking.booking_code,
  customer_id: booking.customer_id || "",
  customer_name: booking.customer_name,
  customer_phone: booking.customer_phone,
  customer_email: booking.customer_email || "",
  tour_id: booking.tour_id,
  tour_title: booking.tour_title,
  destination: departureCityById.get(booking.tour_id) || "",
  departure_date: booking.departure_date,
  booking_date: booking.booking_date || booking.created_date,
  adults: num(booking.adults_count),
  children: num(booking.children_count),
  infants: num(booking.infants_count),
  pax: num(booking.adults_count) + num(booking.children_count) + num(booking.infants_count),
  total: num(booking.total_price),
  paid: paidOf(booking),
  remaining: Math.max(num(booking.total_price) - paidOf(booking), 0),
  status: booking.status,
  payment_status: booking.payment_status || "Unpaid",
  channel: booking.channel || "Website",
  source_post: booking.source_post || "",
  source_post_title: booking.source_post_title || "",
  sale_owner: booking.sale_owner || "",
  voucher_code: booking.voucher_code || "",
  cancellation_reason: booking.cancellation_reason || "",
  days_to_departure: dayDiff(booking.departure_date),
});

const listInput = z.object({
  q: z.string().max(80).optional(),
  status: z.string().max(40).optional(),
  payment: z.string().max(30).optional(),
  tour_id: z.string().max(64).optional(),
  destination: z.string().max(80).optional(),
  channel: z.string().max(30).optional(),
  source_post: z.string().max(200).optional(),
  sale: z.string().max(60).optional(),
  created_from: z.string().max(30).optional(),
  created_to: z.string().max(30).optional(),
  departure_from: z.string().max(30).optional(),
  departure_to: z.string().max(30).optional(),
  from: z.string().max(30).optional(),
  to: z.string().max(30).optional(),
  sort: z.string().max(24).optional(),
  page: z.number().int().min(1).max(500).optional(),
  page_size: z.number().int().min(5).max(200).optional(),
});

export const listAdminBookings = createServerFn({ method: "GET" })
  .validator(listInput)
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const [bookingRows, tourRows] = await Promise.all([
      base44.entities.Booking.list({ sort: "-booking_date", limit: 1000 }),
      base44.entities.Tour.list({ limit: 300 }),
    ]);
    const bookings = asArray(bookingRows);
    const tours = asArray(tourRows);
    const destinationById = new Map(tours.map((tour) => [tour.id, tour.destination || ""]));

    const text = (data.q || "").trim().toLowerCase();
    const createdFrom = data.created_from || data.from;
    const createdTo = data.created_to || data.to;

    const base = bookings.filter((booking) => {
      if (data.tour_id && data.tour_id !== "all" && booking.tour_id !== data.tour_id) return false;
      if (data.destination && data.destination !== "all" && destinationById.get(booking.tour_id) !== data.destination) return false;
      if (data.channel && data.channel !== "all" && (booking.channel || "Website") !== data.channel) return false;
      if (data.source_post && data.source_post !== "all" && (booking.source_post || "") !== data.source_post) return false;
      if (data.sale && data.sale !== "all" && (booking.sale_owner || "") !== data.sale) return false;
      if (!within(booking.booking_date || booking.created_date, createdFrom, createdTo)) return false;
      if (!within(booking.departure_date, data.departure_from, data.departure_to)) return false;
      if (!text) return true;
      return [
        booking.booking_code,
        booking.customer_name,
        booking.customer_phone,
        booking.customer_email,
        booking.tour_title,
        booking.source_post_title,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(text));
    });

    const statusScoped = base.filter((booking) => !data.status || booking.status === data.status);
    const paymentScoped = base.filter((booking) => !data.payment || (booking.payment_status || "Unpaid") === data.payment);

    const statusCounts = { all: base.length };
    BOOKING_STATUSES.forEach((status) => {
      statusCounts[status] = 0;
    });
    paymentScoped.forEach((booking) => {
      statusCounts[booking.status] = (statusCounts[booking.status] || 0) + 1;
    });

    const paymentCounts = { all: base.length, Unpaid: 0, Partial: 0, Paid: 0, "Pending Verification": 0 };
    statusScoped.forEach((booking) => {
      const key = booking.payment_status || "Unpaid";
      paymentCounts[key] = (paymentCounts[key] || 0) + 1;
    });

    const rows = statusScoped
      .filter((booking) => !data.payment || (booking.payment_status || "Unpaid") === data.payment)
      .sort(SORTERS[data.sort] || SORTERS.newest);

    const pageSize = data.page_size || 25;
    const page = data.page || 1;

    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize).map((booking) => compact(booking, destinationById)),
      total: rows.length,
      page,
      pageSize,
      statusCounts,
      paymentCounts,
      totals: {
        value: rows.reduce((sum, booking) => sum + num(booking.total_price), 0),
        collected: rows.reduce((sum, booking) => sum + paidOf(booking), 0),
        paidCount: rows.filter((booking) => (booking.payment_status || "Unpaid") === "Paid").length,
      },
      facets: {
        tours: tours
          .map((tour) => ({ id: tour.id, title: tour.title }))
          .sort((a, b) => String(a.title).localeCompare(String(b.title), "vi")),
        destinations: [...new Set(tours.map((tour) => tour.destination).filter(Boolean))].sort((a, b) =>
          String(a).localeCompare(String(b), "vi"),
        ),
        sales: [...new Set(bookings.map((booking) => booking.sale_owner).filter(Boolean))].sort(),
        posts: [
          ...new Map(
            bookings
              .filter((booking) => booking.source_post)
              .map((booking) => [booking.source_post, booking.source_post_title || booking.source_post]),
          ).entries(),
        ]
          .map(([value, label]) => ({ value, label }))
          .sort((a, b) => String(a.label).localeCompare(String(b.label), "vi")),
      },
    };
  });

const paymentOf = (payment) => ({
  id: payment.id,
  amount: num(payment.amount),
  method: payment.method || "Chuyển khoản",
  kind: payment.kind || "",
  status: payment.status || "Đã thanh toán",
  paid_at: payment.paid_at || payment.created_date,
  confirmed_by: payment.confirmed_by || "",
  receipt_file_uri: payment.receipt_file_uri || "",
  note: payment.note || "",
});

export const getBookingDetail = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const booking = await base44.entities.Booking.get(data.id).catch((error) => {
      if (error?.status === 404) return null;
      throw error;
    });
    if (!booking) return null;

    const [paymentRows, tour, customer] = await Promise.all([
      base44.entities.Payment.filter({ booking_id: booking.id }, { sort: "-paid_at", limit: 100 }),
      booking.tour_id ? base44.entities.Tour.get(booking.tour_id).catch(() => null) : null,
      booking.customer_id ? base44.entities.Customer.get(booking.customer_id).catch(() => null) : null,
    ]);

    const payments = asArray(paymentRows)
      .filter((payment) => payment.direction !== "Chi đối tác")
      .map(paymentOf);

    const collected = payments
      .filter((payment) => payment.status === "Đã thanh toán")
      .reduce((sum, payment) => sum + payment.amount, 0);

    return {
      booking,
      payments,
      collected,
      remaining: Math.max(num(booking.total_price) - collected, 0),
      tour: tour
        ? {
            id: tour.id,
            title: tour.title,
            duration_days: tour.duration_days,
            duration_nights: tour.duration_nights,
            price_adult: num(tour.price_adult),
            price_child: num(tour.price_child),
            scope: tour.scope || "domestic",
          }
        : null,
      customer: customer
        ? { id: customer.id, full_name: customer.full_name, tier: customer.tier || "Mới", tags: customer.tags || [], note: customer.note || "" }
        : null,
    };
  });

const actorOf = async (context) => {
  try {
    const me = await context.getBase44().auth.me();
    return me?.full_name || me?.email || "Quản trị viên";
  } catch (error) {
    return "Quản trị viên";
  }
};

const appendActivity = (booking, entry) => [...(booking.activities || []), { at: new Date().toISOString(), ...entry }];

const paidTotalOf = async (base44, booking) => {
  const rows = asArray(await base44.entities.Payment.filter({ booking_id: booking.id }, { limit: 200 }));
  return rows
    .filter((payment) => payment.direction !== "Chi đối tác" && (payment.status || "Đã thanh toán") === "Đã thanh toán")
    .reduce((sum, payment) => sum + num(payment.amount), 0);
};

const derivedPaymentStatus = (paid, total) => {
  if (paid <= 0) return "Unpaid";
  if (total > 0 && paid >= total) return "Paid";
  return "Partial";
};

export const updateBookingStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1).max(64),
      status: z.enum(BOOKING_STATUSES),
      reason: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const booking = await base44.entities.Booking.get(data.id);
    if (!booking) return { error: "Không tìm thấy đơn đặt tour." };
    if (data.status === booking.status) return { ok: true, status: booking.status };

    const needsReason = data.status === "Đã hủy" || data.status === "Hoàn tiền";
    if (needsReason && !(data.reason || "").trim()) {
      return { error: "Vui lòng nhập lý do trước khi hủy đơn." };
    }

    const actor = await actorOf(context);
    const patch = {
      status: data.status,
      activities: appendActivity(booking, {
        type: "status",
        text: `${booking.status} → ${data.status}${data.reason ? ` · ${data.reason}` : ""}`,
        actor,
        from: booking.status,
        to: data.status,
      }),
    };
    if (needsReason) patch.cancellation_reason = data.reason.trim();

    await base44.entities.Booking.update(booking.id, patch);

    // Hủy đơn đã thu tiền → tạo yêu cầu hoàn tiền theo chính sách hủy, chờ Quản lý duyệt.
    let refund = null;
    if (needsReason) refund = await createRefundFor(base44, { ...booking, ...patch }, data.reason || "");

    return { ok: true, status: data.status, refund };
  });

export const bulkBookingStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ids: z.array(z.string().min(1).max(64)).min(1).max(100),
      status: z.enum(BOOKING_STATUSES),
      reason: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    if ((data.status === "Đã hủy" || data.status === "Hoàn tiền") && !(data.reason || "").trim()) {
      return { error: "Vui lòng nhập lý do trước khi hủy đơn." };
    }
    const actor = await actorOf(context);
    let updated = 0;
    for (const id of data.ids) {
      const booking = await base44.entities.Booking.get(id).catch(() => null);
      if (!booking || booking.status === data.status) continue;
      const patch = {
        status: data.status,
        activities: appendActivity(booking, {
          type: "status",
          text: `Cập nhật hàng loạt: ${booking.status} → ${data.status}${data.reason ? ` · ${data.reason}` : ""}`,
          actor,
          from: booking.status,
          to: data.status,
        }),
      };
      if (data.reason) patch.cancellation_reason = data.reason.trim();
      await base44.entities.Booking.update(id, patch);
      if (data.status === "Đã hủy" || data.status === "Hoàn tiền") {
        await createRefundFor(base44, { ...booking, ...patch }, data.reason || "").catch(() => null);
      }
      updated += 1;
    }
    return { updated };
  });

export const addBookingNote = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64), text: z.string().trim().min(1).max(800) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const booking = await base44.entities.Booking.get(data.id);
    if (!booking) return { error: "Không tìm thấy đơn đặt tour." };
    const actor = await actorOf(context);
    const notes = [...(booking.internal_notes || []), { at: new Date().toISOString(), author: actor, text: data.text }];
    await base44.entities.Booking.update(booking.id, {
      internal_notes: notes,
      activities: appendActivity(booking, { type: "note", text: "Thêm ghi chú nội bộ", actor }),
    });
    return { ok: true, notes };
  });

export const recordBookingPayment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1).max(64),
      amount: z.number().int().positive().max(5_000_000_000),
      method: z.string().max(40).optional(),
      paid_at: z.string().max(40).optional(),
      note: z.string().trim().max(300).optional(),
      receipt_file_uri: z.string().max(400).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const booking = await base44.entities.Booking.get(data.id);
    if (!booking) return { error: "Không tìm thấy đơn đặt tour." };

    const total = num(booking.total_price);
    const before = await paidTotalOf(base44, booking);
    const after = before + data.amount;
    const fullyPaid = total > 0 && after >= total;
    const actor = await actorOf(context);

    await base44.entities.Payment.create({
      direction: "Thu từ khách",
      booking_code: booking.booking_code,
      booking_id: booking.id,
      tour_id: booking.tour_id,
      customer_name: booking.customer_name,
      amount: data.amount,
      method: data.method || "Chuyển khoản",
      kind: fullyPaid ? "Thanh toán còn lại" : before > 0 ? "Thanh toán còn lại" : "Đặt cọc",
      status: "Đã thanh toán",
      paid_at: data.paid_at ? new Date(data.paid_at).toISOString() : new Date().toISOString(),
      confirmed_by: actor,
      receipt_file_uri: data.receipt_file_uri || "",
      note: data.note || "",
    });

    await base44.entities.Booking.update(booking.id, {
      paid_amount: after,
      payment_status: derivedPaymentStatus(after, total),
      activities: appendActivity(booking, {
        type: "payment",
        text: `Nhận ${data.amount.toLocaleString("vi-VN")}₫ · ${data.method || "Chuyển khoản"}`,
        actor,
      }),
    });

    return {
      ok: true,
      paid_amount: after,
      remaining: Math.max(total - after, 0),
      payment_status: derivedPaymentStatus(after, total),
    };
  });

export const addBookingPayment = recordBookingPayment;

export const duplicateBooking = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const booking = await base44.entities.Booking.get(data.id);
    if (!booking) return { error: "Không tìm thấy đơn đặt tour." };
    const actor = await actorOf(context);
    const code = await nextBookingCode(base44);
    const clone = {
      booking_code: code,
      booking_date: new Date().toISOString(),
      tour_id: booking.tour_id,
      tour_title: booking.tour_title,
      customer_id: booking.customer_id || "",
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      customer_email: booking.customer_email || "",
      departure_date: booking.departure_date,
      adults_count: num(booking.adults_count),
      children_count: num(booking.children_count),
      infants_count: num(booking.infants_count),
      unit_price_adult: num(booking.unit_price_adult),
      unit_price_child: num(booking.unit_price_child),
      unit_price_infant: num(booking.unit_price_infant),
      discount_percent: num(booking.discount_percent),
      total_price: num(booking.total_price),
      paid_amount: 0,
      special_requests: booking.special_requests || "",
      customer_note: booking.customer_note || "",
      channel: booking.channel || "Website",
      sale_owner: booking.sale_owner || "",
      status: "Chờ xác nhận",
      payment_status: "Unpaid",
      passengers: booking.passengers || [],
      activities: [{ at: new Date().toISOString(), type: "created", text: `Nhân bản từ đơn ${booking.booking_code}`, actor }],
    };
    const created = await base44.entities.Booking.create(clone);
    return { ok: true, id: created.id, booking_code: created.booking_code };
  });

// Tour đã kết thúc + đã xác nhận + đã thu đủ → Hoàn tất (vẫn chỉnh tay được).
export const sweepCompletedBookings = createServerFn({ method: "POST" }).handler(async ({ context }) => {
  const base44 = context.getBase44();
  const [bookingRows, tourRows] = await Promise.all([
    base44.entities.Booking.filter(
      { status: { $in: ["Đã xác nhận", "Đã thanh toán"] }, payment_status: "Paid" },
      { limit: 500 },
    ),
    base44.entities.Tour.list({ limit: 300 }),
  ]);
  const durationById = new Map(asArray(tourRows).map((tour) => [tour.id, num(tour.duration_days) || 1]));
  const today = new Date();
  let updated = 0;

  for (const booking of asArray(bookingRows)) {
    const start = parse(booking.departure_date);
    if (!start) continue;
    const end = new Date(start.getTime() + (durationById.get(booking.tour_id) || 1) * 86400000);
    if (end >= today) continue;
    await base44.entities.Booking.update(booking.id, {
      status: "Hoàn tất",
      activities: appendActivity(booking, {
        type: "status",
        text: `${booking.status} → Hoàn tất (tour đã kết thúc)`,
        actor: "Hệ thống",
        from: booking.status,
        to: "Hoàn tất",
      }),
    });
    updated += 1;
  }
  return { updated };
});

const emailBody = (booking) =>
  [
    `Xin chào ${booking.customer_name},`,
    "",
    `GenTravel xác nhận đơn đặt tour "${booking.tour_title}" của quý khách.`,
    `Mã đơn: ${booking.booking_code}`,
    `Ngày khởi hành: ${booking.departure_date || "đang cập nhật"}`,
    `Số khách: ${num(booking.adults_count)} người lớn, ${num(booking.children_count)} trẻ em${num(booking.infants_count) ? `, ${num(booking.infants_count)} em bé` : ""}`,
    `Tổng giá trị: ${num(booking.total_price).toLocaleString("vi-VN")}₫`,
    "",
    "Chuyên viên GenTravel sẽ liên hệ trước ngày khởi hành để dặn dò hành trình. Hotline 1900 6789.",
  ].join("\n");

export const sendBookingEmails = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(20) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const service = context.getBase44().asServiceRole;
    const actor = await actorOf(context);
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const id of data.ids) {
      const booking = await base44.entities.Booking.get(id).catch(() => null);
      if (!booking?.customer_email) {
        skipped += 1;
        continue;
      }
      try {
        await service.integrations.Core.SendEmail({
          to: booking.customer_email,
          subject: `GenTravel xác nhận đơn đặt tour ${booking.booking_code}`,
          body: emailBody(booking),
        });
        sent += 1;
        await base44.entities.Booking.update(booking.id, {
          activities: appendActivity(booking, {
            type: "email",
            text: `Đã gửi email xác nhận tới ${booking.customer_email}`,
            actor,
          }),
        });
      } catch (error) {
        failed += 1;
      }
    }

    return { sent, skipped, failed };
  });