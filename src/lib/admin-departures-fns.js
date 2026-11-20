import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { paidOf } from "@/lib/booking-status";
import { costLineTotal } from "@/lib/tour-profit";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const num = (value) => Number(value) || 0;
const dayKey = (value) => String(value || "").slice(0, 10);
const CLOSED = ["Đã hủy", "Hoàn tiền"];
const paxOf = (booking) => num(booking.adults_count) + num(booking.children_count) + num(booking.infants_count);

const daysFromToday = (date) => {
  const target = new Date(`${dayKey(date)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  return Math.round((target - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
};

const buildContext = async (base44) => {
  const [departureRows, bookingRows, costRows, tourRows] = await Promise.all([
    base44.entities.Departure.list({ sort: "departure_date", limit: 800 }),
    base44.entities.Booking.list({ limit: 1000 }),
    base44.entities.TourCost.list({ limit: 800 }),
    base44.entities.Tour.list({ limit: 400 }),
  ]);
  return {
    departures: asArray(departureRows),
    bookings: asArray(bookingRows),
    costs: asArray(costRows),
    tours: asArray(tourRows),
  };
};

const financeOf = (departure, ctx, tourById) => {
  const key = dayKey(departure.departure_date);
  const departBookings = ctx.bookings.filter(
    (booking) => booking.tour_id === departure.tour_id && dayKey(booking.departure_date) === key && !CLOSED.includes(booking.status),
  );
  const pax = departBookings.reduce((sum, booking) => sum + paxOf(booking), 0);
  const revenue = departBookings.reduce((sum, booking) => sum + num(booking.total_price), 0);
  const collected = departBookings.reduce((sum, booking) => sum + paidOf(booking), 0);

  const tourPax = ctx.bookings
    .filter((booking) => booking.tour_id === departure.tour_id && !CLOSED.includes(booking.status))
    .reduce((sum, booking) => sum + paxOf(booking), 0);

  const direct = ctx.costs
    .filter((cost) => cost.departure_id === departure.id)
    .reduce((sum, cost) => sum + costLineTotal(cost, pax), 0);

  const tourLevelTotal = ctx.costs
    .filter((cost) => cost.tour_id === departure.tour_id && !cost.departure_id)
    .reduce((sum, cost) => sum + costLineTotal(cost, tourPax || 1), 0);
  const share = tourPax > 0 ? Math.min(pax / tourPax, 1) : 0;
  const allocated = Math.round(tourLevelTotal * share);

  const cost = direct + allocated;
  const profit = collected - cost;
  const total = num(departure.seats_total);
  const booked = pax;
  const held = num(departure.seats_held);
  const today = new Date().toISOString().slice(0, 10);
  const status =
    ["Đã hủy", "Hoàn tất", "Đóng"].includes(departure.status) || departure.status === "Đã khởi hành"
      ? departure.status
      : key < today
        ? "Đã khởi hành"
        : total > 0 && total - booked - held <= 0
          ? "Đã đầy"
          : total > 0 && (total - booked - held) / total <= 0.2
            ? "Sắp đầy"
            : "Mở bán";

  return {
    pax,
    orders: departBookings.length,
    revenue,
    collected,
    direct_cost: direct,
    allocated_cost: allocated,
    cost,
    profit,
    margin: collected > 0 ? (profit / collected) * 100 : 0,
    total,
    booked,
    held,
    remaining: Math.max(total - booked - held, 0),
    fill: total > 0 ? Math.min(Math.round(((booked + held) / total) * 100), 100) : 0,
    status,
    tour_code: tourById.get(departure.tour_id)?.tour_code || "",
  };
};

export const listAdminDepartures = createServerFn({ method: "GET" })
  .validator(
    z.object({
      tour_id: z.string().max(64).optional(),
      status: z.string().max(20).optional(),
      month: z.string().max(7).optional(),
      from: z.string().max(10).optional(),
      to: z.string().max(10).optional(),
      q: z.string().max(60).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const ctx = await buildContext(base44);
    const tourById = new Map(ctx.tours.map((tour) => [tour.id, tour]));
    const today = new Date().toISOString().slice(0, 10);

    const rows = ctx.departures.map((departure) => ({
      ...departure,
      tour_title: departure.tour_title || tourById.get(departure.tour_id)?.title || "Tour",
      departure_date: dayKey(departure.departure_date),
      return_date: departure.return_date || "",
      ...financeOf(departure, ctx, tourById),
      days_to_departure: daysFromToday(departure.departure_date),
    }));

    const text = (data.q || "").trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (data.month && !row.departure_date.startsWith(data.month)) return false;
      if (data.from && row.departure_date < data.from) return false;
      if (data.to && row.departure_date > data.to) return false;
      if (data.tour_id && data.tour_id !== "all" && row.tour_id !== data.tour_id) return false;
      if (data.status && data.status !== "all" && row.status !== data.status) return false;
      if (!text) return true;
      return [row.tour_title, row.tour_code, row.guide_name, row.departure_point]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(text));
    });

    const sorted = [...filtered].sort((a, b) => a.departure_date.localeCompare(b.departure_date));

    const alerts = sorted
      .filter((row) => row.days_to_departure !== null && row.days_to_departure >= 0)
      .flatMap((row) => {
        if (row.fill >= 90) {
          return [{ key: "nearFull", label: `${row.tour_title} · ${row.departure_date} đã lấp ${row.fill}%`, tone: "danger", id: row.id }];
        }
        if (row.days_to_departure <= 7 && row.fill < 50) {
          return [{ key: "lowFill", label: `${row.tour_title} · ${row.departure_date} còn ${row.days_to_departure} ngày, mới lấp ${row.fill}%`, tone: "warning", id: row.id }];
        }
        return [];
      });

    const upcoming = sorted.filter((row) => row.days_to_departure !== null && row.days_to_departure >= 0);

    return {
      items: sorted,
      total: sorted.length,
      alerts,
      summary: {
        departures: sorted.length,
        pax: sorted.reduce((sum, row) => sum + row.pax, 0),
        collected: sorted.reduce((sum, row) => sum + row.collected, 0),
        cost: sorted.reduce((sum, row) => sum + row.cost, 0),
        profit: sorted.reduce((sum, row) => sum + row.profit, 0),
        seats: sorted.reduce((sum, row) => sum + row.total, 0),
        booked: sorted.reduce((sum, row) => sum + row.booked, 0),
        lowFill: upcoming.filter((row) => row.days_to_departure <= 7 && row.fill < 50).length,
        nearFull: upcoming.filter((row) => row.fill >= 90).length,
      },
      facets: {
        tours: ctx.tours.map((tour) => ({ id: tour.id, title: tour.title, code: tour.tour_code || "" })).sort((a, b) => a.title.localeCompare(b.title, "vi")),
      },
    };
  });

export const getDepartureDetail = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const departure = await base44.entities.Departure.get(data.id).catch((error) => {
      if (error?.status === 404) return null;
      throw error;
    });
    if (!departure) return null;

    const ctx = await buildContext(base44);
    const tourById = new Map(ctx.tours.map((tour) => [tour.id, tour]));
    const key = dayKey(departure.departure_date);
    const finance = financeOf(departure, ctx, tourById);

    const guests = ctx.bookings
      .filter((booking) => booking.tour_id === departure.tour_id && dayKey(booking.departure_date) === key)
      .sort((a, b) => String(a.customer_name).localeCompare(String(b.customer_name), "vi"))
      .map((booking) => ({
        id: booking.id,
        code: booking.booking_code,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        adults: num(booking.adults_count),
        children: num(booking.children_count),
        infants: num(booking.infants_count),
        pax: paxOf(booking),
        status: booking.status,
        payment_status: booking.payment_status || "Unpaid",
        total: num(booking.total_price),
        paid: paidOf(booking),
        sale_owner: booking.sale_owner || "",
        note: booking.special_requests || booking.customer_note || "",
      }));

    const costs = ctx.costs
      .filter((cost) => cost.departure_id === departure.id)
      .map((cost) => ({
        id: cost.id,
        partner_name: cost.partner_name || "",
        category: cost.category || "Khác",
        amount: num(cost.amount),
        basis: cost.basis || "Toàn tour",
        quantity: num(cost.quantity) || 1,
        status: cost.status || "Chưa chi",
        paid_at: cost.paid_at || "",
        line_total: costLineTotal(cost, finance.pax),
        note: cost.note || "",
        receipt_file_uri: cost.receipt_file_uri || "",
      }));

    const tourLevelCosts = ctx.costs
      .filter((cost) => cost.tour_id === departure.tour_id && !cost.departure_id)
      .map((cost) => ({
        id: cost.id,
        partner_name: cost.partner_name || "",
        category: cost.category || "Khác",
        amount: num(cost.amount),
        basis: cost.basis || "Toàn tour",
        quantity: num(cost.quantity) || 1,
        status: cost.status || "Chưa chi",
      }))
      .slice(0, 40);

    const tour = tourById.get(departure.tour_id);

    return {
      departure: {
        ...departure,
        departure_date: key,
        tour_title: departure.tour_title || tour?.title || "Tour",
        tour_code: tour?.tour_code || "",
        return_date:
          departure.return_date ||
          (() => {
            const start = new Date(`${key}T00:00:00`);
            const days = num(tour?.duration_days) || 1;
            return Number.isNaN(start.getTime()) ? "" : new Date(start.getTime() + (days - 1) * 86400000).toISOString().slice(0, 10);
          })(),
        duration_days: num(tour?.duration_days),
      },
      finance,
      guests,
      costs,
      tour_level_costs: tourLevelCosts,
      tour: tour ? { id: tour.id, title: tour.title, slug: tour.slug, departure_point: tour.departure_point || "" } : null,
    };
  });

const costInput = z.object({
  id: z.string().min(1).max(64).optional(),
  departure_id: z.string().min(1).max(64),
  partner_id: z.string().max(64).optional(),
  partner_name: z.string().trim().max(120).optional(),
  category: z.string().max(40),
  amount: z.number().int().min(0).max(5_000_000_000),
  basis: z.enum(["Toàn tour", "Mỗi khách"]).optional(),
  quantity: z.number().min(0).max(999).optional(),
  status: z.enum(["Chưa chi", "Đã chi"]).optional(),
  paid_at: z.string().max(20).optional(),
  note: z.string().trim().max(300).optional(),
  receipt_file_uri: z.string().max(400).optional(),
});

export const saveDepartureCost = createServerFn({ method: "POST" })
  .validator(costInput)
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const departure = await base44.entities.Departure.get(data.departure_id).catch(() => null);
    if (!departure) return { error: "Không tìm thấy kỳ khởi hành." };

    const payload = {
      tour_id: departure.tour_id,
      tour_title: departure.tour_title,
      departure_id: departure.id,
      partner_id: data.partner_id || "",
      partner_name: data.partner_name || "",
      category: data.category,
      amount: data.amount,
      basis: data.basis || "Toàn tour",
      quantity: data.quantity ?? 1,
      status: data.status || "Chưa chi",
      paid_at: data.paid_at || "",
      note: data.note || "",
      receipt_file_uri: data.receipt_file_uri || "",
    };

    if (data.id) await base44.entities.TourCost.update(data.id, payload);
    else await base44.entities.TourCost.create(payload);

    return { ok: true };
  });

export const deleteDepartureCost = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    await context.getBase44().entities.TourCost.delete(data.id);
    return { ok: true };
  });