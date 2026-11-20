import { cashIn } from "@/lib/payment-utils";
import { paxOf } from "@/lib/departure-seats";
import { costLineTotal } from "@/lib/tour-profit";
import { dueDateOf } from "@/lib/setting-defaults";

const CLOSED = ["Đã hủy", "Hoàn tiền"];
const day = (value) => String(value || "").slice(0, 10);
const num = (value) => Number(value) || 0;

export const RANGES = [
  { key: "30d", label: "30 ngày" },
  { key: "90d", label: "90 ngày" },
  { key: "month", label: "Tháng này" },
  { key: "quarter", label: "Quý này" },
  { key: "year", label: "Năm nay" },
];

export function boundsOf(range) {
  const now = new Date();
  if (range === "month") return { from: day(new Date(now.getFullYear(), now.getMonth(), 1).toISOString()), to: day(now.toISOString()) };
  if (range === "quarter") return { from: day(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString()), to: day(now.toISOString()) };
  if (range === "year") return { from: `${now.getFullYear()}-01-01`, to: day(now.toISOString()) };
  const days = Number(String(range).replace("d", "")) || 30;
  return { from: day(new Date(now.getTime() - (days - 1) * 86400000).toISOString()), to: day(now.toISOString()) };
}

function cashByCodeOf(payments) {
  const map = new Map();
  payments.forEach((row) => {
    if (row.direction === "Chi đối tác" || !row.booking_code) return;
    const refund = row.kind === "Hoàn tiền" || num(row.amount) < 0;
    const value = refund
      ? row.status === "Đã hoàn tiền" ? -Math.abs(num(row.amount)) : 0
      : row.status === "Đã thanh toán" ? num(row.amount) : 0;
    if (!value) return;
    map.set(row.booking_code, (map.get(row.booking_code) || 0) + value);
  });
  return map;
}

/** Gộp toàn bộ 7 báo cáo từ dữ liệu thật, dùng chung một bộ lọc. */
export function buildAnalytics({ bookings, tours, costs, payments, departures = [], filters = {} }) {
  const { from, to } = filters.from && filters.to ? { from: filters.from, to: filters.to } : boundsOf(filters.range || "90d");
  const tourById = new Map(tours.map((tour) => [tour.id, tour]));
  const cashByCode = cashByCodeOf(payments);

  const scoped = bookings.filter((booking) => {
    if (filters.scope && filters.scope !== "all" && (tourById.get(booking.tour_id)?.scope || "domestic") !== filters.scope) return false;
    if (filters.tourId && filters.tourId !== "all" && booking.tour_id !== filters.tourId) return false;
    if (filters.channel && filters.channel !== "all" && booking.channel !== filters.channel) return false;
    if (filters.staff && filters.staff !== "all" && (booking.sale_owner || "") !== filters.staff) return false;
    return true;
  });
  const inRange = scoped.filter((booking) => {
    const created = day(booking.booking_date || booking.created_date);
    return created >= from && created <= to;
  });
  const active = inRange.filter((booking) => !CLOSED.includes(booking.status));
  const cancelled = inRange.filter((booking) => CLOSED.includes(booking.status));
  const cashOf = (booking) => cashByCode.get(booking.booking_code) || 0;

  // 1. Doanh thu & số đơn theo kỳ, so cùng kỳ năm trước
  const granularity = filters.granularity || "month";
  const periodOf = (iso) => {
    if (granularity === "year") return iso.slice(0, 4);
    if (granularity === "quarter") return `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
    return iso.slice(0, 7);
  };
  const prevPeriodOf = (key) => {
    if (granularity === "year") return String(Number(key) - 1);
    if (granularity === "quarter") return `${Number(key.slice(0, 4)) - 1}-${key.slice(5)}`;
    return `${Number(key.slice(0, 4)) - 1}-${key.slice(5)}`;
  };
  const periodMap = new Map();
  inRange.forEach((booking) => {
    const key = periodOf(day(booking.booking_date || booking.created_date));
    const entry = periodMap.get(key) || { key, orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += cashOf(booking);
    periodMap.set(key, entry);
  });
  const series = [...periodMap.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((row) => ({ ...row, prevRevenue: periodMap.get(prevPeriodOf(row.key))?.revenue || 0 }));

  // 2. Theo tour và theo kỳ khởi hành
  const paxByTour = new Map();
  active.forEach((booking) => paxByTour.set(booking.tour_id, (paxByTour.get(booking.tour_id) || 0) + paxOf(booking)));
  const costByTour = new Map();
  costs.forEach((cost) => {
    const pax = paxByTour.get(cost.tour_id) || 0;
    if (!pax) return;
    costByTour.set(cost.tour_id, (costByTour.get(cost.tour_id) || 0) + costLineTotal(cost, pax));
  });

  const tourMap = new Map();
  const departureMap = new Map();
  active.forEach((booking) => {
    const tour = tourById.get(booking.tour_id);
    const row = tourMap.get(booking.tour_id) || { id: booking.tour_id, name: tour?.title || booking.tour_title || "Tour", orders: 0, guests: 0, revenue: 0 };
    row.orders += 1;
    row.guests += paxOf(booking);
    row.revenue += cashOf(booking);
    tourMap.set(booking.tour_id, row);

    const key = `${booking.tour_id}|${day(booking.departure_date)}`;
    const dep = departureMap.get(key) || { key, date: day(booking.departure_date), name: tour?.title || booking.tour_title || "Tour", orders: 0, guests: 0, revenue: 0, tourId: booking.tour_id };
    dep.orders += 1;
    dep.guests += paxOf(booking);
    dep.revenue += cashOf(booking);
    departureMap.set(key, dep);
  });
  const withCost = (row, cost) => ({ ...row, cost, profit: row.revenue - cost, margin: row.revenue > 0 ? ((row.revenue - cost) / row.revenue) * 100 : 0 });
  const byTour = [...tourMap.values()].map((row) => withCost(row, costByTour.get(row.id) || 0)).sort((a, b) => b.revenue - a.revenue);
  const byDeparture = [...departureMap.values()]
    .map((row) => withCost(row, Math.round((costByTour.get(row.tourId) || 0) * (paxByTour.get(row.tourId) ? row.guests / paxByTour.get(row.tourId) : 0))))
    .sort((a, b) => b.revenue - a.revenue);

  // 3. Hiệu suất theo nguồn đặt và nhân viên
  const groupPerformance = (keyOf) => {
    const map = new Map();
    inRange.forEach((booking) => {
      const key = keyOf(booking) || "Chưa gán";
      const entry = map.get(key) || { name: key, orders: 0, revenue: 0, cancelled: 0 };
      if (CLOSED.includes(booking.status)) entry.cancelled += 1;
      else {
        entry.orders += 1;
        entry.revenue += cashOf(booking);
      }
      map.set(key, entry);
    });
    return [...map.values()]
      .map((row) => {
        const total = row.orders + row.cancelled;
        return { ...row, total, cancelRate: total ? (row.cancelled / total) * 100 : 0, avgOrder: row.orders ? row.revenue / row.orders : 0 };
      })
      .sort((a, b) => b.revenue - a.revenue);
  };
  const byChannel = groupPerformance((booking) => booking.channel);
  const byStaff = groupPerformance((booking) => booking.sale_owner);

  // 4. Hủy & hoàn tiền
  const refundRows = payments.filter((row) => row.kind === "Hoàn tiền" && row.status === "Đã hoàn tiền");
  const refundInRange = refundRows.filter((row) => {
    const created = day(row.paid_at || row.created_date);
    return created >= from && created <= to;
  });
  const reasonMap = new Map();
  cancelled.forEach((booking) => {
    const reason = (booking.cancellation_reason || "Không ghi lý do").trim();
    reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
  });
  const cancelReasons = [...reasonMap.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);

  // 5. Tỷ lệ lấp đầy chỗ theo tour và tháng
  const depRows = departures.filter((dep) => {
    const date = day(dep.departure_date);
    if (!date) return false;
    if (filters.tourId && filters.tourId !== "all" && dep.tour_id !== filters.tourId) return false;
    if (filters.scope && filters.scope !== "all" && (tourById.get(dep.tour_id)?.scope || "domestic") !== filters.scope) return false;
    return date >= from && date <= to;
  });
  const fillByMonth = new Map();
  depRows.forEach((dep) => {
    const month = day(dep.departure_date).slice(0, 7);
    const entry = fillByMonth.get(month) || { month, seats: 0, booked: 0, departures: 0 };
    entry.seats += num(dep.seats_total);
    entry.booked += num(dep.seats_booked);
    entry.departures += 1;
    fillByMonth.set(month, entry);
  });
  const fillRate = [...fillByMonth.values()].map((row) => ({ ...row, rate: row.seats ? (row.booked / row.seats) * 100 : 0 })).sort((a, b) => a.month.localeCompare(b.month));

  // 6. Phân tích khách hàng
  const customerMap = new Map();
  scoped.forEach((booking) => {
    const key = String(booking.customer_phone || booking.customer_name || "").replace(/[\s.-]/g, "");
    if (!key) return;
    const entry = customerMap.get(key) || { name: booking.customer_name, phone: booking.customer_phone, orders: 0, spent: 0, first: day(booking.booking_date || booking.created_date) };
    entry.orders += 1;
    entry.spent += cashOf(booking);
    entry.first = entry.first && entry.first < day(booking.booking_date || booking.created_date) ? entry.first : day(booking.booking_date || booking.created_date);
    customerMap.set(key, entry);
  });
  const customers = [...customerMap.values()];
  const newCustomers = customers.filter((row) => row.first >= from && row.first <= to).length;
  const returning = customers.length - newCustomers;
  const topCustomers = [...customers].sort((a, b) => b.spent - a.spent).slice(0, 10);
  const paxSplit = active.reduce(
    (acc, booking) => ({
      adults: acc.adults + num(booking.adults_count),
      children: acc.children + num(booking.children_count),
      infants: acc.infants + num(booking.infants_count),
    }),
    { adults: 0, children: 0, infants: 0 },
  );

  // 7. Công nợ theo tuổi nợ
  const dueDays = filters.dueDays ?? 7;
  const bucketOf = (dueDate, hasDue) => {
    if (!hasDue) return ">30";
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(`${dueDate}T00:00:00`).getTime()) / 86400000);
    if (days <= 7) return "0–7";
    if (days <= 30) return "8–30";
    return ">30";
  };
  const receivableBuckets = { "0–7": 0, "8–30": 0, ">30": 0 };
  const receivableRows = scoped
    .filter((booking) => !CLOSED.includes(booking.status))
    .map((booking) => {
      const total = num(booking.total_price);
      const paid = cashOf(booking);
      const remaining = Math.max(total - paid, 0);
      return { booking, remaining, due: dueDateOf(booking, dueDays) };
    })
    .filter((row) => row.remaining > 0);
  receivableRows.forEach((row) => {
    receivableBuckets[bucketOf(row.due, Boolean(row.due))] += row.remaining;
  });
  const partnerMap = new Map();
  costs.forEach((cost) => {
    if (!cost.partner_id) return;
    const remaining = cost.status === "Đã chi" ? 0 : costLineTotal(cost, paxByTour.get(cost.tour_id) || 1);
    if (!remaining) return;
    partnerMap.set(cost.partner_name || "Đối tác", (partnerMap.get(cost.partner_name || "Đối tác") || 0) + remaining);
  });
  const payableBuckets = { "0–7": 0, "8–30": 0, ">30": 0 };
  [...partnerMap.entries()].forEach(([, value]) => {
    payableBuckets[">30"] += value;
  });

  return {
    from,
    to,
    totals: {
      orders: active.length,
      cancelled: cancelled.length,
      revenue: cashIn(payments, from, to).net,
      gross: cashIn(payments, from, to).gross,
      refunds: refundInRange.reduce((sum, row) => sum + Math.abs(num(row.amount)), 0),
      cost: [...costByTour.values()].reduce((sum, value) => sum + value, 0),
      profit: cashIn(payments, from, to).net - [...costByTour.values()].reduce((sum, value) => sum + value, 0),
      guests: active.reduce((sum, booking) => sum + paxOf(booking), 0),
      cancelRate: inRange.length ? (cancelled.length / inRange.length) * 100 : 0,
      receivable: receivableRows.reduce((sum, row) => sum + row.remaining, 0),
      payable: [...partnerMap.values()].reduce((sum, value) => sum + value, 0),
    },
    series,
    byTour,
    byDeparture,
    byChannel,
    byStaff,
    cancelReasons,
    refunds: refundInRange,
    fillRate,
    customers: { total: customers.length, newCustomers, returning, topCustomers, paxSplit },
    aging: { receivableBuckets, payableBuckets },
  };
}