const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));

// Mã đơn mới theo dãy tuần tự BK-YYMM-0001. Mã cũ BK-xxxx được giữ nguyên.
export async function nextBookingCode(service) {
  const now = new Date();
  const prefix = `BK-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}-`;

  const rows = asArray(
    await service.entities.Booking.filter({ booking_code: { $regex: `^${prefix}` } }, { limit: 500 }),
  );

  let max = 0;
  rows.forEach((row) => {
    const tail = Number(String(row.booking_code).slice(prefix.length));
    if (Number.isFinite(tail) && tail > max) max = tail;
  });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    max += 1;
    const candidate = `${prefix}${String(max).padStart(4, "0")}`;
    const clash = await service.entities.Booking.count({ booking_code: candidate });
    if (!clash) return candidate;
  }

  return `${prefix}${String(Date.now()).slice(-4)}`;
}