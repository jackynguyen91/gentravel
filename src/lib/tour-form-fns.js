import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { slugify } from "@/lib/slugify";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const num = (value) => Number(value) || 0;
const dayKey = (value) => String(value || "").slice(0, 10);
const CLOSED = ["Đã hủy", "Hoàn tiền"];
const paxOf = (booking) => num(booking.adults_count) + num(booking.children_count) + num(booking.infants_count);

const addDays = (iso, days) => {
  const start = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";
  return new Date(start.getTime() + days * 86400000).toISOString().slice(0, 10);
};

// Giữ danh sách ngày khởi hành trên Tour khớp với các kỳ đang mở bán.
const syncTourDates = async (base44, tourId) => {
  const rows = asArray(await base44.entities.Departure.filter({ tour_id: tourId }, { sort: "departure_date", limit: 200 }));
  const dates = rows
    .filter((row) => !["Đóng", "Đã hủy", "Hoàn tất"].includes(row.status))
    .map((row) => dayKey(row.departure_date))
    .filter(Boolean);
  await base44.entities.Tour.update(tourId, { departure_dates: [...new Set(dates)] }).catch(() => null);
};

export const listTourDestinations = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const rows = asArray(await context.getBase44().entities.Destination.list({ sort: "name", limit: 300 }));
  return rows.map((row) => ({ id: row.id, name: row.name, country: row.country || "", region: row.region || "" }));
});

export const createTourDestination = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().trim().min(1).max(80), region: z.string().max(30).optional() }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const rows = asArray(await base44.entities.Destination.list({ sort: "name", limit: 300 }));
    const existing = rows.find((row) => String(row.name).toLowerCase() === data.name.toLowerCase());
    if (existing) return { id: existing.id, name: existing.name };

    const created = await base44.entities.Destination.create({
      name: data.name,
      slug: slugify(data.name),
      region: data.region || "",
    });
    return { id: created.id, name: created.name };
  });

export const listTourDepartures = createServerFn({ method: "GET" })
  .validator(z.object({ tour_id: z.string().min(1).max(64), duration_days: z.number().min(1).max(60).optional() }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const [departureRows, bookingRows] = await Promise.all([
      base44.entities.Departure.filter({ tour_id: data.tour_id }, { sort: "departure_date", limit: 200 }),
      base44.entities.Booking.filter({ tour_id: data.tour_id }, { limit: 400 }),
    ]);
    const bookings = asArray(bookingRows).filter((booking) => !CLOSED.includes(booking.status));
    const today = new Date().toISOString().slice(0, 10);
    const days = data.duration_days || 1;

    return asArray(departureRows).map((row) => {
      const date = dayKey(row.departure_date);
      const booked = bookings
        .filter((booking) => dayKey(booking.departure_date) === date)
        .reduce((sum, booking) => sum + paxOf(booking), 0);
      const total = num(row.seats_total);
      const held = num(row.seats_held);
      const remaining = Math.max(total - booked - held, 0);
      const closed = ["Đóng", "Đã hủy", "Hoàn tất", "Đã khởi hành"].includes(row.status) || date < today;
      const status = closed
        ? row.status
        : remaining <= 0
          ? "Đã đầy"
          : total > 0 && remaining / total <= 0.2
            ? "Sắp đầy"
            : "Mở bán";

      return {
        id: row.id,
        departure_date: date,
        return_date: dayKey(row.return_date) || addDays(date, days - 1),
        seats_total: total,
        seats_booked: booked,
        seats_held: held,
        remaining,
        price_override: num(row.price_override) || 0,
        status,
        raw_status: row.status || "Mở bán",
        has_bookings: booked > 0,
        note: row.note || "",
      };
    });
  });

export const saveTourDeparture = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tour_id: z.string().min(1).max(64),
      tour_title: z.string().max(200).optional(),
      departure_date: z.string().min(10).max(10),
      seats_total: z.number().min(0).max(500),
      price_override: z.number().min(0).max(1_000_000_000).optional(),
      duration_days: z.number().min(1).max(60).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const rows = asArray(await base44.entities.Departure.filter({ tour_id: data.tour_id }, { limit: 200 }));
    const existing = rows.find((row) => dayKey(row.departure_date) === data.departure_date);
    const payload = {
      tour_id: data.tour_id,
      tour_title: data.tour_title || "",
      departure_date: data.departure_date,
      return_date: addDays(data.departure_date, (data.duration_days || 1) - 1),
      seats_total: data.seats_total,
      price_override: data.price_override || 0,
    };

    if (existing) await base44.entities.Departure.update(existing.id, payload);
    else await base44.entities.Departure.create({ ...payload, seats_booked: 0, seats_held: 0, status: "Mở bán" });

    await syncTourDates(base44, data.tour_id);
    return { ok: true };
  });

export const updateTourDeparture = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1).max(64),
      seats_total: z.number().min(0).max(500).optional(),
      price_override: z.number().min(0).max(1_000_000_000).optional(),
      status: z.enum(["Mở bán", "Đóng"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const departure = await base44.entities.Departure.get(data.id);
    const patch = {};
    if (data.seats_total != null) patch.seats_total = data.seats_total;
    if (data.price_override != null) patch.price_override = data.price_override;
    if (data.status) patch.status = data.status;
    await base44.entities.Departure.update(data.id, patch);
    await syncTourDates(base44, departure.tour_id);
    return { ok: true };
  });

export const deleteTourDeparture = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const departure = await base44.entities.Departure.get(data.id);
    const rows = asArray(await base44.entities.Booking.filter({ tour_id: departure.tour_id }, { limit: 400 }));
    const hasBookings = rows.some(
      (booking) => dayKey(booking.departure_date) === dayKey(departure.departure_date) && !CLOSED.includes(booking.status),
    );
    if (hasBookings) return { error: "Ngày này đã có đơn — chỉ đóng bán, không xoá." };

    await base44.entities.Departure.delete(data.id);
    await syncTourDates(base44, departure.tour_id);
    return { ok: true };
  });

export const bulkCreateTourDepartures = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tour_id: z.string().min(1).max(64),
      tour_title: z.string().max(200).optional(),
      weekday: z.number().int().min(0).max(6),
      months: z.number().int().min(1).max(12),
      seats_total: z.number().min(0).max(500),
      duration_days: z.number().min(1).max(60).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const existingRows = asArray(await base44.entities.Departure.filter({ tour_id: data.tour_id }, { limit: 300 }));
    const taken = new Set(existingRows.map((row) => dayKey(row.departure_date)));

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth() + data.months, start.getDate());
    const dates = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      if (cursor.getDay() !== data.weekday) continue;
      const iso = cursor.toISOString().slice(0, 10);
      if (!taken.has(iso)) dates.push(iso);
    }

    if (dates.length) {
      await base44.entities.Departure.bulkCreate(
        dates.map((date) => ({
          tour_id: data.tour_id,
          tour_title: data.tour_title || "",
          departure_date: date,
          return_date: addDays(date, (data.duration_days || 1) - 1),
          seats_total: data.seats_total,
          seats_booked: 0,
          seats_held: 0,
          price_override: 0,
          status: "Mở bán",
        })),
      );
    }

    await syncTourDates(base44, data.tour_id);
    return { ok: true, created: dates.length };
  });

export const syncTourDeparturesFromBookings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tour_id: z.string().min(1).max(64),
      tour_title: z.string().max(200).optional(),
      seats_total: z.number().min(0).max(500),
      duration_days: z.number().min(1).max(60).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const [departureRows, bookingRows] = await Promise.all([
      base44.entities.Departure.filter({ tour_id: data.tour_id }, { limit: 300 }),
      base44.entities.Booking.filter({ tour_id: data.tour_id }, { limit: 400 }),
    ]);
    const taken = new Set(asArray(departureRows).map((row) => dayKey(row.departure_date)));
    const dates = [
      ...new Set(
        asArray(bookingRows)
          .filter((booking) => !CLOSED.includes(booking.status))
          .map((booking) => dayKey(booking.departure_date))
          .filter((date) => date && !taken.has(date)),
      ),
    ];

    if (dates.length) {
      await base44.entities.Departure.bulkCreate(
        dates.map((date) => ({
          tour_id: data.tour_id,
          tour_title: data.tour_title || "",
          departure_date: date,
          return_date: addDays(date, (data.duration_days || 1) - 1),
          seats_total: data.seats_total,
          seats_booked: 0,
          seats_held: 0,
          price_override: 0,
          status: "Mở bán",
        })),
      );
    }

    await syncTourDates(base44, data.tour_id);
    return { ok: true, created: dates.length };
  });