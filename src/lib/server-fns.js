import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { nextBookingCode } from "@/lib/booking-code";
import { syncCustomer } from "@/lib/customer-sync";
import { isPublished } from "@/lib/blog-catalog";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));

export const getTours = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const base44 = context.getBase44();
  const rows = await base44.entities.Tour.list({ sort: "-created_date", limit: 200 });
  // Tour đã lưu trữ bị ẩn khỏi website nhưng dữ liệu vẫn giữ nguyên.
  return asArray(rows).filter((tour) => !tour.archived);
});

export const getTourBySlug = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const rows = asArray(await base44.entities.Tour.filter({ slug: data.slug }, { limit: 1 }));
    return rows[0] ?? null;
  });

// Ngày khởi hành còn mở bán & còn chỗ — dùng cho tab ngày và ô chọn ngày khi đặt tour.
export const getTourDepartures = createServerFn({ method: "GET" })
  .validator(z.object({ tour_id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44().asServiceRole;
    const rows = asArray(
      await base44.entities.Departure.filter({ tour_id: data.tour_id }, { sort: "departure_date", limit: 120 }),
    );
    const today = new Date().toISOString().slice(0, 10);
    const CLOSED = ["Đóng", "Đã hủy", "Hoàn tất", "Đã khởi hành", "Đã đầy"];

    return rows
      .map((row) => {
        const date = String(row.departure_date || "").slice(0, 10);
        const total = Number(row.seats_total) || 0;
        const remaining = Math.max(total - (Number(row.seats_booked) || 0) - (Number(row.seats_held) || 0), 0);
        return { date, remaining, price_override: Number(row.price_override) || 0, status: row.status || "Mở bán" };
      })
      .filter((row) => row.date >= today && !CLOSED.includes(row.status) && row.remaining > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  });

export const getReviewsForTour = createServerFn({ method: "GET" })
  .validator(z.object({ tour_slug: z.string().min(1).max(200) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const rows = await base44.entities.Review.filter(
      { tour_slug: data.tour_slug },
      { sort: "-created_date", limit: 50 },
    );
    return asArray(rows);
  });

export const getPosts = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const base44 = context.getBase44();
  const rows = await base44.entities.BlogPost.list({ sort: "-published_at", limit: 100 });
  // Chỉ bài đã đăng (hoặc đã tới giờ hẹn) mới hiển thị ra website.
  return asArray(rows).filter((post) => isPublished(post));
});

export const getActiveServices = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const base44 = context.getBase44();
  const rows = await base44.entities.Service.filter({ is_active: true }, { sort: "sort_order", limit: 100 });
  // Thứ tự do admin kéo thả trong quản trị quyết định thứ tự hiển thị trên website.
  return asArray(rows).sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
});

export const getPostBySlug = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const rows = asArray(await base44.entities.BlogPost.filter({ slug: data.slug }, { limit: 1 }));
    const post = rows[0];
    return post && isPublished(post) ? post : null;
  });

const bookingInput = z.object({
  tour_id: z.string().min(1).max(64),
  customer_name: z.string().trim().min(2).max(80),
  customer_phone: z.string().trim().min(8).max(20),
  customer_email: z.string().trim().email().max(120),
  departure_date: z.string().min(8).max(20),
  adults_count: z.number().int().min(1).max(20),
  children_count: z.number().int().min(0).max(20),
  special_requests: z.string().trim().max(600).optional(),
  source_post: z.string().trim().max(200).optional(),
});

export const getPostSuggestions = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const rows = asArray(await base44.entities.BlogPost.filter({ slug: data.slug }, { limit: 1 }));
    const post = rows[0];
    if (!post) return { tours: [], services: [] };

    const [tourRows, serviceRows] = await Promise.all([
      base44.entities.Tour.list({ limit: 200 }),
      base44.entities.Service.list({ limit: 200 }),
    ]);
    const tours = asArray(tourRows).filter(
      (tour) => !tour.archived && (tour.status || "Đang bán") !== "Nháp",
    );
    const services = asArray(serviceRows).filter(
      (service) => !service.archived && (service.status || "Đang hiển thị") === "Đang hiển thị",
    );

    const tourById = new Map(tours.map((tour) => [tour.id, tour]));
    const pickedTours = [];
    (post.related_tour_ids || []).forEach((id) => {
      const tour = tourById.get(id);
      if (tour && !pickedTours.includes(tour)) pickedTours.push(tour);
    });
    if (pickedTours.length < 3 && post.destination) {
      tours
        .filter((tour) => tour.destination === post.destination && !pickedTours.includes(tour))
        .sort(
          (a, b) =>
            Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) ||
            Number(b.rating || 0) - Number(a.rating || 0),
        )
        .slice(0, 3 - pickedTours.length)
        .forEach((tour) => pickedTours.push(tour));
    }

    const serviceById = new Map(services.map((service) => [service.id, service]));
    const pickedServices = [];
    (post.related_service_ids || []).forEach((id) => {
      const service = serviceById.get(id);
      if (service && !pickedServices.includes(service)) pickedServices.push(service);
    });
    if (pickedServices.length < 2) {
      services
        .filter((service) => !pickedServices.includes(service))
        .filter((service) => !post.destination || service.destination === post.destination)
        .slice(0, 2 - pickedServices.length)
        .forEach((service) => pickedServices.push(service));
    }

    return { tours: pickedTours.slice(0, 3), services: pickedServices.slice(0, 2) };
  });

export const trackPostEvent = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().trim().min(1).max(200), type: z.enum(["view", "cta"]) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44().asServiceRole;
    const rows = asArray(await base44.entities.BlogPost.filter({ slug: data.slug }, { limit: 1 }));
    const post = rows[0];
    if (!post) return { ok: false };
    const field = data.type === "cta" ? "cta_click_count" : "view_count";
    await base44.entities.BlogPost.update(post.id, { [field]: (Number(post[field]) || 0) + 1 });
    return { ok: true };
  });

export const createBooking = createServerFn({ method: "POST" })
  .validator(bookingInput)
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44().asServiceRole;

    const tour = await base44.entities.Tour.get(data.tour_id);
    if (!tour) return { error: "Không tìm thấy tour bạn chọn." };

    const adultUnit =
      Number(tour.discount_percent) > 0
        ? Math.round((Number(tour.price_adult) * (100 - Number(tour.discount_percent))) / 100)
        : Number(tour.price_adult) || 0;
    const total = adultUnit * data.adults_count + (Number(tour.price_child) || 0) * data.children_count;

    let sourcePost = null;
    if (data.source_post) {
      const rows = asArray(await base44.entities.BlogPost.filter({ slug: data.source_post }, { limit: 1 }));
      sourcePost = rows[0] || null;
    }
    const channel = sourcePost ? "Bài viết" : "Website";

    const code = await nextBookingCode(base44);
    const customerId = await syncCustomer(base44, {
      name: data.customer_name,
      phone: data.customer_phone,
      email: data.customer_email,
      channel,
    });

    const booking = await base44.entities.Booking.create({
      booking_code: code,
      tour_id: tour.id,
      tour_title: tour.title,
      customer_id: customerId || "",
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email,
      departure_date: data.departure_date,
      adults_count: data.adults_count,
      children_count: data.children_count,
      infants_count: 0,
      unit_price_adult: adultUnit,
      unit_price_child: Number(tour.price_child) || 0,
      unit_price_infant: Number(tour.price_infant) || 0,
      discount_percent: Number(tour.discount_percent) || 0,
      total_price: total,
      special_requests: data.special_requests || "",
      customer_note: data.special_requests || "",
      channel,
      source_post: sourcePost?.slug || "",
      source_post_title: sourcePost?.title || "",
      status: "Chờ xác nhận",
      payment_status: "Unpaid",
    });

    if (sourcePost) {
      // Đếm số đơn phát sinh từ bài viết để báo cáo nội dung.
      await base44.entities.BlogPost.update(sourcePost.id, {
        order_count: (Number(sourcePost.order_count) || 0) + 1,
      }).catch(() => null);
    }

    try {
      await base44.integrations.Core.SendEmail({
        to: data.customer_email,
        subject: `GenTravel xác nhận yêu cầu đặt tour ${code}`,
        body: [
          `Xin chào ${data.customer_name},`,
          "",
          `GenTravel đã nhận được yêu cầu đặt tour "${tour.title}".`,
          `Mã đặt chỗ của bạn: ${code}`,
          `Ngày khởi hành: ${data.departure_date}`,
          `Số khách: ${data.adults_count} người lớn, ${data.children_count} trẻ em`,
          `Tạm tính: ${total.toLocaleString("vi-VN")}₫`,
          "",
          "Chuyên viên GenTravel sẽ gọi xác nhận trong vòng 30 phút làm việc. Hotline hỗ trợ: 1900 6789.",
        ].join("\n"),
      });
    } catch (emailError) {
      // Không để lỗi gửi email làm mất yêu cầu đặt tour đã ghi nhận.
    }

    return {
      booking_code: booking.booking_code,
      total_price: booking.total_price,
      tour_title: booking.tour_title,
      departure_date: booking.departure_date,
      adults_count: booking.adults_count,
      children_count: booking.children_count,
      customer_phone: booking.customer_phone,
    };
  });

export const markTransferSubmitted = createServerFn({ method: "POST" })
  .validator(
    z.object({
      booking_code: z.string().trim().min(3).max(40),
      phone: z.string().trim().min(8).max(20),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44().asServiceRole;
    const rows = asArray(
      await base44.entities.Booking.filter({ booking_code: data.booking_code }, { limit: 1 }),
    );
    const booking = rows[0];
    if (!booking) return { error: "Không tìm thấy đơn đặt tour." };

    const normalize = (value) => String(value || "").replace(/[\s.-]/g, "");
    if (normalize(booking.customer_phone) !== normalize(data.phone)) {
      return { error: "Thông tin đơn đặt tour không khớp." };
    }
    if (booking.payment_status === "Paid") return { ok: true, payment_status: "Paid" };

    await base44.entities.Booking.update(booking.id, { payment_status: "Pending Verification" });
    return { ok: true, payment_status: "Pending Verification" };
  });

export const getBookingPaymentStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      booking_code: z.string().trim().min(3).max(40),
      phone: z.string().trim().min(8).max(20),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44().asServiceRole;
    const rows = asArray(
      await base44.entities.Booking.filter({ booking_code: data.booking_code }, { limit: 1 }),
    );
    const booking = rows[0];
    if (!booking) return { error: "Không tìm thấy đơn đặt tour." };

    const normalize = (value) => String(value || "").replace(/[\s.-]/g, "");
    if (normalize(booking.customer_phone) !== normalize(data.phone)) {
      return { error: "Thông tin đơn đặt tour không khớp." };
    }

    return { payment_status: booking.payment_status || "Unpaid", status: booking.status };
  });

export const createReview = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tour_id: z.string().min(1).max(64),
      tour_slug: z.string().min(1).max(200),
      customer_name: z.string().trim().min(2).max(60),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(1000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44().asServiceRole;

    const review = await base44.entities.Review.create({
      tour_id: data.tour_id,
      tour_slug: data.tour_slug,
      customer_name: data.customer_name,
      rating: data.rating,
      comment: data.comment || "",
    });

    const { rows = [] } = await base44.entities.Review.aggregate({
      query: { tour_slug: data.tour_slug },
      groupBy: "tour_slug",
      avg: ["rating"],
    });
    const stats = rows[0];
    if (stats) {
      await base44.entities.Tour.update(data.tour_id, {
        rating: Math.round(Number(stats.avg_rating) * 10) / 10,
        review_count: stats.count,
      });
    }

    return review;
  });