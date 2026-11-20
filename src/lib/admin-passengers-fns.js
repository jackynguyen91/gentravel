import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PASSENGER_TYPES, GENDERS, ID_TYPES, maskIdNumber } from "@/lib/passengers";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));

const actorOf = async (base44) => {
  try {
    const me = await base44.auth.me();
    return { id: me?.id || "", name: me?.full_name || me?.email || "Quản trị viên", role: me?.role || "user" };
  } catch (error) {
    return { id: "", name: "Quản trị viên", role: "user" };
  }
};

const passengerNo = (rows) => rows.reduce((max, row) => Math.max(max, Number(row.passenger_no) || 0), 0) + 1;

const rebuildBookingSnapshot = async (base44, bookingId) => {
  const booking = await base44.entities.Booking.get(bookingId).catch(() => null);
  if (!booking) return;
  const rows = asArray(await base44.entities.Passenger.filter({ booking_id: bookingId }, { sort: "passenger_no", limit: 100 }));
  await base44.entities.Booking.update(bookingId, {
    passengers: rows.map((row) => ({ full_name: row.full_name, type: row.passenger_type, note: row.note || "" })),
  });
};

const appendActivity = (booking, entry) => [...(booking.activities || []), { at: new Date().toISOString(), ...entry }];

/** Tạo bản ghi hành khách từ danh sách tên đã lưu sẵn trên đơn (đơn cũ). */
const ensureFromSnapshot = async (base44, booking) => {
  const snapshot = booking.passengers || [];
  if (snapshot.length === 0) return false;
  await base44.entities.Passenger.bulkCreate(
    snapshot.map((row, index) => ({
      booking_id: booking.id,
      booking_code: booking.booking_code,
      tour_id: booking.tour_id,
      passenger_no: index + 1,
      full_name: row.full_name || "Chưa rõ tên",
      passenger_type: PASSENGER_TYPES.includes(row.type) ? row.type : "Người lớn",
      id_type: "CCCD",
      note: row.note || "",
      updated_by: "Hệ thống",
    })),
  );
  return true;
};

export const listBookingPassengers = createServerFn({ method: "GET" })
  .validator(z.object({ booking_id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const booking = await base44.entities.Booking.get(data.booking_id).catch(() => null);
    if (!booking) return { items: [], canViewFull: false, counts: { total: 0, missing_id: 0 } };

    let rows = asArray(await base44.entities.Passenger.filter({ booking_id: booking.id }, { sort: "passenger_no", limit: 100 }));
    if (rows.length === 0 && (booking.passengers || []).length > 0) {
      const created = await ensureFromSnapshot(base44, booking).catch(() => false);
      if (created) {
        rows = asArray(await base44.entities.Passenger.filter({ booking_id: booking.id }, { sort: "passenger_no", limit: 100 }));
      }
    }

    const actor = await actorOf(base44);
    const items = rows.map((row) => ({
      id: row.id,
      passenger_no: row.passenger_no || 0,
      full_name: row.full_name,
      passenger_type: row.passenger_type || "Người lớn",
      gender: row.gender || "",
      birth_date: row.birth_date || "",
      id_type: row.id_type || "",
      id_number_masked: maskIdNumber(row.id_number, row.id_type),
      has_id: Boolean(row.id_number),
      id_issue_date: row.id_issue_date || "",
      id_issued_by: row.id_issued_by || "",
      id_expiry_date: row.id_expiry_date || "",
      nationality: row.nationality || "",
      phone: row.phone || "",
      note: row.note || "",
      updated_by: row.updated_by || "",
    }));

    return {
      items,
      canViewFull: actor.role === "admin",
      counts: {
        total: items.length,
        missing_id: items.filter((item) => !item.has_id).length,
      },
    };
  });

const passengerInput = z.object({
  id: z.string().min(1).max(64).optional(),
  booking_id: z.string().min(1).max(64),
  full_name: z.string().trim().min(2).max(80),
  passenger_type: z.enum(PASSENGER_TYPES),
  gender: z.enum([...GENDERS, ""]).optional(),
  birth_date: z.string().max(20).optional(),
  id_type: z.enum(ID_TYPES).optional(),
  id_number: z.string().trim().max(30).optional(),
  id_issue_date: z.string().max(20).optional(),
  id_issued_by: z.string().trim().max(100).optional(),
  id_expiry_date: z.string().max(20).optional(),
  nationality: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(20).optional(),
  note: z.string().trim().max(300).optional(),
});

export const savePassenger = createServerFn({ method: "POST" })
  .validator(passengerInput)
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const actor = await actorOf(base44);
    if (actor.role !== "admin") return { error: "Chỉ quản trị viên được sửa thông tin giấy tờ." };

    const booking = await base44.entities.Booking.get(data.booking_id).catch(() => null);
    if (!booking) return { error: "Không tìm thấy đơn đặt tour." };

    const { id, booking_id, ...fields } = data;
    const payload = { ...fields, updated_by: actor.name };

    if (id) {
      await base44.entities.Passenger.update(id, payload);
    } else {
      const existing = asArray(await base44.entities.Passenger.filter({ booking_id }, { limit: 100 }));
      await base44.entities.Passenger.create({
        ...payload,
        booking_id,
        booking_code: booking.booking_code,
        tour_id: booking.tour_id,
        passenger_no: passengerNo(existing),
      });
    }

    await rebuildBookingSnapshot(base44, booking_id);
    await base44.entities.Booking.update(booking_id, {
      activities: appendActivity(booking, {
        type: "passenger",
        text: `${id ? "Cập nhật" : "Thêm"} hành khách ${fields.full_name}`,
        actor: actor.name,
      }),
    });

    return { ok: true };
  });

export const deletePassenger = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const actor = await actorOf(base44);
    if (actor.role !== "admin") return { error: "Chỉ quản trị viên được xoá hành khách." };

    const passenger = await base44.entities.Passenger.get(data.id).catch(() => null);
    if (!passenger) return { error: "Không tìm thấy hành khách." };

    await base44.entities.Passenger.delete(passenger.id);
    await rebuildBookingSnapshot(base44, passenger.booking_id);

    const booking = await base44.entities.Booking.get(passenger.booking_id).catch(() => null);
    if (booking) {
      await base44.entities.Booking.update(booking.id, {
        activities: appendActivity(booking, { type: "passenger", text: `Xoá hành khách ${passenger.full_name}`, actor: actor.name }),
      });
    }
    return { ok: true };
  });

export const revealPassengerId = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1).max(64) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const actor = await actorOf(base44);
    if (actor.role !== "admin") return { error: "Chỉ quản trị viên được xem số giấy tờ đầy đủ." };

    const passenger = await base44.entities.Passenger.get(data.id).catch(() => null);
    if (!passenger) return { error: "Không tìm thấy hành khách." };

    await base44.entities.ActivityLog.create({
      module: "Đơn hàng",
      action: "Xem số giấy tờ",
      detail: `${passenger.booking_code} · ${passenger.full_name} · ${passenger.id_type || "CCCD"}`,
      actor: actor.name,
      entity_id: passenger.id,
    });

    return { id_number: passenger.id_number || "" };
  });