import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TOUR_STATUSES } from "@/lib/tour-status";
import { paidOf } from "@/lib/booking-status";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const num = (value) => Number(value) || 0;
const dayKey = (value) => String(value || "").slice(0, 10);
const CLOSED = ["Đã hủy", "Hoàn tiền"];

export const THEME_TAGS = ["Khám phá", "Nghỉ dưỡng", "Văn hóa", "Gia đình", "Honeymoon", "Mạo hiểm", "Food tour"];

export const adultPrice = (tour) => {
  const discount = num(tour?.discount_percent);
  const base = num(tour?.price_adult);
  return discount > 0 ? Math.round((base * (100 - discount)) / 100) : base;
};

const paxOf = (booking) => num(booking.adults_count) + num(booking.children_count) + num(booking.infants_count);

const sorters = {
  newest: (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0),
  "title-asc": (a, b) => String(a.title).localeCompare(String(b.title), "vi"),
  "price-desc": (a, b) => b.final_price - a.final_price,
  "price-asc": (a, b) => a.final_price - b.final_price,
  "orders-desc": (a, b) => b.orders - a.orders,
  "collected-desc": (a, b) => b.collected - a.collected,
  "departure-asc": (a, b) => (a.next_departure || "9999").localeCompare(b.next_departure || "9999"),
  "fill-asc": (a, b) => (a.next_remaining ?? 999) - (b.next_remaining ?? 999),
};

export const listAdminTours = createServerFn({ method: "GET" })
  .validator(
    z.object({
      q: z.string().max(80).optional(),
      status: z.string().max(30).optional(),
      category: z.string().max(40).optional(),
      scope: z.string().max(20).optional(),
      destination: z.string().max(80).optional(),
      departure_point: z.string().max(80).optional(),
      tag: z.string().max(40).optional(),
      featured: z.string().max(10).optional(),
      archived: z.string().max(10).optional(),
      sort: z.string().max(24).optional(),
      page: z.number().int().min(1).max(200).optional(),
      page_size: z.number().int().min(10).max(100).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const [tourRows, bookingRows, departureRows] = await Promise.all([
      base44.entities.Tour.list({ sort: "-created_date", limit: 400 }),
      base44.entities.Booking.list({ limit: 1000 }),
      base44.entities.Departure.list({ sort: "departure_date", limit: 800 }),
    ]);
    const tours = asArray(tourRows);
    const bookings = asArray(bookingRows).filter((booking) => !CLOSED.includes(booking.status));
    const departures = asArray(departureRows);
    const today = new Date().toISOString().slice(0, 10);

    const rows = tours.map((tour) => {
      const tourBookings = bookings.filter((booking) => booking.tour_id === tour.id);
      const tourDepartures = departures.filter((dep) => dep.tour_id === tour.id);
      const upcoming = tourDepartures
        .filter((dep) => dayKey(dep.departure_date) >= today && !["Đã hủy", "Hoàn tất"].includes(dep.status))
        .sort((a, b) => dayKey(a.departure_date).localeCompare(dayKey(b.departure_date)))[0];

      let nextBooked = 0;
      if (upcoming) {
        nextBooked = tourBookings
          .filter((booking) => dayKey(booking.departure_date) === dayKey(upcoming.departure_date))
          .reduce((sum, booking) => sum + paxOf(booking), 0);
      }
      const nextTotal = upcoming ? num(upcoming.seats_total) : 0;
      const nextHeld = upcoming ? num(upcoming.seats_held) : 0;

      return {
        id: tour.id,
        title: tour.title,
        slug: tour.slug,
        tour_code: tour.tour_code || "",
        cover_image: tour.cover_image || "",
        destination: tour.destination || "",
        departure_point: tour.departure_point || "",
        category: tour.category || "",
        scope: tour.scope || "domestic",
        theme_tags: tour.theme_tags || [],
        duration_days: num(tour.duration_days),
        duration_nights: num(tour.duration_nights),
        price_adult: num(tour.price_adult),
        original_price: num(tour.original_price) || num(tour.price_adult),
        price_child: num(tour.price_child),
        price_infant: num(tour.price_infant),
        discount_percent: num(tour.discount_percent),
        final_price: adultPrice(tour),
        status: tour.status || "Đang bán",
        archived: Boolean(tour.archived),
        is_featured: Boolean(tour.is_featured),
        route_days: (tour.route || []).length,
        orders: tourBookings.length,
        guests: tourBookings.reduce((sum, booking) => sum + paxOf(booking), 0),
        value: tourBookings.reduce((sum, booking) => sum + num(booking.total_price), 0),
        collected: tourBookings.reduce((sum, booking) => sum + paidOf(booking), 0),
        has_bookings: tourBookings.length > 0,
        departures: tourDepartures.length,
        next_departure: upcoming ? dayKey(upcoming.departure_date) : "",
        next_total: nextTotal,
        next_booked: nextBooked,
        next_remaining: upcoming ? Math.max(nextTotal - nextBooked - nextHeld, 0) : null,
        created_date: tour.created_date,
      };
    });

    const active = rows.filter((row) => !row.archived);
    const archivedRows = rows.filter((row) => row.archived);
    const scoped = data.archived === "only" ? archivedRows : data.archived === "all" ? rows : active;

    const text = (data.q || "").trim().toLowerCase();
    const filtered = scoped.filter((row) => {
      if (data.status && data.status !== "all" && row.status !== data.status) return false;
      if (data.category && data.category !== "all" && row.category !== data.category) return false;
      if (data.scope && data.scope !== "all" && row.scope !== data.scope) return false;
      if (data.destination && data.destination !== "all" && row.destination !== data.destination) return false;
      if (data.departure_point && data.departure_point !== "all" && row.departure_point !== data.departure_point) return false;
      if (data.tag && data.tag !== "all" && !row.theme_tags.includes(data.tag)) return false;
      if (data.featured === "yes" && !row.is_featured) return false;
      if (data.featured === "no" && row.is_featured) return false;
      if (!text) return true;
      return [row.title, row.tour_code, row.destination, row.slug, row.departure_point, ...row.theme_tags]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(text));
    });

    const statusCounts = { all: active.length };
    TOUR_STATUSES.forEach((status) => {
      statusCounts[status] = active.filter((row) => row.status === status).length;
    });

    const sorted = [...filtered].sort(sorters[data.sort] || sorters.newest);
    const pageSize = data.page_size || 20;
    const page = data.page || 1;

    return {
      items: sorted.slice((page - 1) * pageSize, page * pageSize),
      total: sorted.length,
      page,
      pageSize,
      statusCounts,
      archivedCount: archivedRows.length,
      totals: {
        collected: filtered.reduce((sum, row) => sum + row.collected, 0),
        value: filtered.reduce((sum, row) => sum + row.value, 0),
        orders: filtered.reduce((sum, row) => sum + row.orders, 0),
      },
      facets: {
        categories: [...new Set(active.map((row) => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")),
        destinations: [...new Set(active.map((row) => row.destination).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")),
        departurePoints: [...new Set(active.map((row) => row.departure_point).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")),
        tags: [...new Set(active.flatMap((row) => row.theme_tags))].sort((a, b) => a.localeCompare(b, "vi")),
      },
    };
  });

export const toggleTourFeatured = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64), value: z.boolean() }))
  .handler(async ({ data, context }) => {
    await context.getBase44().entities.Tour.update(data.id, { is_featured: data.value });
    return { ok: true, value: data.value };
  });

export const archiveTour = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64), restore: z.boolean().optional() }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    if (data.restore) {
      await base44.entities.Tour.update(data.id, { archived: false, status: "Đang bán" });
      return { ok: true };
    }
    await base44.entities.Tour.update(data.id, { archived: true, status: "Tạm dừng", is_featured: false });
    return { ok: true };
  });

export const duplicateTour = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const tour = await base44.entities.Tour.get(data.id);
    if (!tour) return { error: "Không tìm thấy tour." };

    const all = asArray(await base44.entities.Tour.list({ limit: 400 }));
    const nextNo =
      all.reduce((max, row) => {
        const match = /^TOUR-(\d+)$/.exec(row.tour_code || "");
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0) + 1;

    const payload = { ...tour };
    ["id", "created_date", "updated_date", "created_by_id"].forEach((key) => delete payload[key]);
    const created = await base44.entities.Tour.create({
      ...payload,
      title: `${tour.title} (bản sao)`,
      slug: `${tour.slug}-ban-sao-${Date.now().toString().slice(-4)}`,
      tour_code: `TOUR-${String(nextNo).padStart(3, "0")}`,
      status: "Nháp",
      archived: false,
      is_featured: false,
      view_count: 0,
      review_count: 0,
    });

    return { ok: true, id: created.id, title: created.title };
  });

export const deleteTour = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const count = await base44.entities.Booking.count({ tour_id: data.id });
    if (count > 0) {
      return { error: `Tour đã có ${count} đơn đặt, không thể xoá cứng. Hãy dùng “Lưu trữ” hoặc chuyển sang “Tạm dừng”.`, blocked: true };
    }
    await base44.entities.Tour.delete(data.id);
    return { ok: true };
  });