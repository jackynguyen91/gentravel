import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { nextBookingCode } from "@/lib/booking-code";
import { syncCustomer } from "@/lib/customer-sync";
import { cashIn, receivedForBooking } from "@/lib/payment-utils";
import { requireAdmin } from "@/lib/auth-middleware";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const num = (value) => Number(value) || 0;
const parse = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};
const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};
const bookingDate = (booking) => parse(booking.booking_date) || parse(booking.created_date);
const isPaid = (booking) => booking.payment_status === "Paid";
const pax = (booking) => num(booking.adults_count) + num(booking.children_count);

function resolveRange({ range = "30d", from, to }) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (range === "custom" && from && to) {
    return { start: startOfDay(parse(from) || now), end: addDays(startOfDay(parse(to) || now), 1), preset: "custom" };
  }
  if (range === "today") return { start: startOfDay(now), end: endOfToday, preset: "today" };
  if (range === "7d") return { start: startOfDay(addDays(now, -6)), end: endOfToday, preset: "7d" };
  if (range === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfToday, preset: "month" };
  if (range === "quarter") {
    const quarterStart = Math.floor(now.getMonth() / 3) * 3;
    return { start: new Date(now.getFullYear(), quarterStart, 1), end: endOfToday, preset: "quarter" };
  }
  if (range === "year") return { start: new Date(now.getFullYear(), 0, 1), end: endOfToday, preset: "year" };
  return { start: startOfDay(addDays(now, -29)), end: endOfToday, preset: "30d" };
}

function previousRange(start, end, mode) {
  if (mode === "yoy") {
    const s = new Date(start);
    s.setFullYear(s.getFullYear() - 1);
    const e = new Date(end);
    e.setFullYear(e.getFullYear() - 1);
    return { start: s, end: e };
  }
  const span = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - span), end: new Date(start.getTime()) };
}

function summarize(bookings, toursById, departures, start, end, payments = []) {
  const rows = bookings.filter((booking) => {
    const date = bookingDate(booking);
    return date && date >= start && date <= end;
  });
  const tours = toursById;
  const paid = rows.filter(isPaid);
  // Doanh thu đã thanh toán = thực thu từ sổ giao dịch trừ hoàn tiền (cùng định nghĩa với trang Thanh toán).
  const revenue = cashIn(payments, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)).net;
  const expected = rows
    .filter((item) => item.status === "Đã xác nhận" && !isPaid(item))
    .reduce((sum, item) => sum + num(item.total_price), 0);
  const cancelled = rows.filter((item) => item.status === "Đã hủy").length;
  const guests = rows.filter((item) => item.status !== "Đã hủy").reduce((sum, item) => sum + pax(item), 0);
  const receivable = rows
    .filter((item) => item.status !== "Đã hủy")
    .reduce((sum, item) => sum + Math.max(num(item.total_price) - receivedForBooking(item, payments), 0), 0);
  const cost = paid.reduce((sum, item) => {
    const tour = tours.get(item.tour_id);
    if (!tour) return sum;
    return sum + num(tour.cost_adult) * num(item.adults_count) + num(tour.cost_child) * num(item.children_count);
  }, 0);
  const seats = departures.filter((dep) => {
    const date = parse(dep.departure_date);
    return date && date >= start && date <= end && dep.status !== "Đã hủy";
  });
  const seatsTotal = seats.reduce((sum, dep) => sum + num(dep.seats_total), 0);
  const seatsBooked = seats.reduce((sum, dep) => sum + num(dep.seats_booked), 0);

  return {
    revenue,
    expected,
    orders: rows.length,
    aov: rows.length ? Math.round(revenue / Math.max(paid.length, 1)) : 0,
    guests,
    cancelled,
    cancelRate: rows.length ? (cancelled / rows.length) * 100 : 0,
    fillRate: seatsTotal ? (seatsBooked / seatsTotal) * 100 : 0,
    receivable,
    cost,
    profit: revenue - cost,
  };
}

const UNITS = { day: 1, week: 7 };
function makeBuckets(start, end, unit) {
  const buckets = [];
  if (unit === "month") {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor < end) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      buckets.push({ start: new Date(cursor), end: next, label: `T${cursor.getMonth() + 1}/${String(cursor.getFullYear()).slice(2)}` });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets;
  }
  if (unit === "quarter") {
    const cursor = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
    while (cursor < end) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 1);
      buckets.push({ start: new Date(cursor), end: next, label: `Q${Math.floor(cursor.getMonth() / 3) + 1}/${String(cursor.getFullYear()).slice(2)}` });
      cursor.setMonth(cursor.getMonth() + 3);
    }
    return buckets;
  }
  const step = UNITS[unit] || 7;
  const cursor = startOfDay(start);
  while (cursor < end) {
    const next = addDays(cursor, step);
    buckets.push({
      start: new Date(cursor),
      end: next,
      label: cursor.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
    });
    cursor.setDate(cursor.getDate() + step);
  }
  return buckets;
}

function seriesFor(bookings, payments, start, end, unit, prevShiftStart) {
  const buckets = makeBuckets(start, end, unit);
  if (buckets.length > 40) return [];
  return buckets.map((bucket) => {
    const inBucket = bookings.filter((booking) => {
      const date = bookingDate(booking);
      return date && date >= bucket.start && date < bucket.end;
    });
    const revenue = cashIn(payments, bucket.start.toISOString().slice(0, 10), bucket.end.toISOString().slice(0, 10)).net;
    const prevStart = new Date(bucket.start.getTime() + prevShiftStart);
    const prevEnd = new Date(bucket.end.getTime() + prevShiftStart);
    const prevRevenue = cashIn(payments, prevStart.toISOString().slice(0, 10), prevEnd.toISOString().slice(0, 10)).net;
    return { label: bucket.label, revenue, orders: inBucket.length, prevRevenue };
  });
}

const GROUP_LABEL = { domestic: "Tour nội địa", international: "Tour quốc tế" };

export const getDashboard = createServerFn({ method: "GET" })
  .validator(
    z.object({
      range: z.string().max(20).optional(),
      from: z.string().max(30).optional(),
      to: z.string().max(30).optional(),
      scope: z.string().max(30).optional(),
      destination: z.string().max(80).optional(),
      channel: z.string().max(30).optional(),
      sale: z.string().max(60).optional(),
      compare: z.string().max(10).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const [bookingRows, tourRows, departureRows, paymentRows, serviceRequestRows, blogRows] = await Promise.all([
      base44.entities.Booking.list({ sort: "-booking_date", limit: 1000 }),
      base44.entities.Tour.list({ limit: 300 }),
      base44.entities.Departure.list({ sort: "departure_date", limit: 500 }),
      base44.entities.Payment.list({ limit: 1000 }),
      base44.entities.ServiceRequest.list({ sort: "-created_date", limit: 500 }),
      base44.entities.BlogPost.list({ limit: 400 }),
    ]);
    const serviceRequests = asArray(serviceRequestRows);
    const blogPosts = asArray(blogRows).filter((post) => !post.archived && (post.status || "Đã đăng") !== "Lưu trữ");
    const bookings = asArray(bookingRows);
    const tours = asArray(tourRows);
    const departures = asArray(departureRows);
    const payments = asArray(paymentRows);
    const toursById = new Map(tours.map((tour) => [tour.id, tour]));

    // Thực thu theo từng đơn (đã trừ hoàn tiền) để mọi biểu đồ dùng chung một định nghĩa doanh thu.
    const cashByCode = new Map();
    payments.forEach((row) => {
      if (row.direction === "Chi đối tác" || !row.booking_code) return;
      const isRefundRow = row.kind === "Hoàn tiền" || num(row.amount) < 0;
      const amount = isRefundRow
        ? row.status === "Đã hoàn tiền" ? -Math.abs(num(row.amount)) : 0
        : row.status === "Đã thanh toán" ? num(row.amount) : 0;
      if (!amount) return;
      cashByCode.set(row.booking_code, (cashByCode.get(row.booking_code) || 0) + amount);
    });
    const cashOf = (booking) => cashByCode.get(booking.booking_code) || 0;

    const { start, end } = resolveRange(data);
    const prev = previousRange(start, end, data.compare || "prev");
    const shift = data.compare === "yoy" ? -365 * 24 * 3600 * 1000 : -(end.getTime() - start.getTime());

    const matches = (booking) => {
      if (data.channel && booking.channel !== data.channel) return false;
      if (data.sale && booking.sale_owner !== data.sale) return false;
      const tour = toursById.get(booking.tour_id);
      if (data.scope && data.scope !== "all") {
        if ((tour?.scope || "domestic") !== data.scope) return false;
      }
      if (data.destination && data.destination !== "all" && tour?.destination !== data.destination) return false;
      return true;
    };
    const scoped = bookings.filter(matches);
    const inRange = scoped.filter((booking) => {
      const date = bookingDate(booking);
      return date && date >= start && date <= end;
    });
    const paidInRange = inRange.filter(isPaid);
    const current = summarize(scoped, toursById, departures, start, end, payments);
    const previous = summarize(scoped, toursById, departures, prev.start, prev.end, payments);

    const delta = (key) => {
      const now = current[key];
      const before = previous[key];
      if (!before) return now ? 100 : 0;
      return ((now - before) / Math.abs(before)) * 100;
    };

    // Sparklines: chia kỳ thành 12 điểm theo chỉ số chính
    const paidRevenueInRange = cashIn(payments, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)).net;
    const sparkOf = (valueOf) => {
      const buckets = makeBuckets(start, end, (end - start) / 86400000 > 60 ? "week" : "day").slice(0, 12);
      return buckets.map((bucket) =>
        inRange.reduce((sum, booking) => {
          const date = bookingDate(booking);
          return date && date >= bucket.start && date < bucket.end ? sum + valueOf(booking) : sum;
        }, 0),
      );
    };
    const cashSpark = () =>
      makeBuckets(start, end, (end - start) / 86400000 > 60 ? "week" : "day")
        .slice(0, 12)
        .map((bucket) => cashIn(payments, bucket.start.toISOString().slice(0, 10), bucket.end.toISOString().slice(0, 10)).net);

    const kpis = [
      { key: "revenue", label: "Doanh thu đã thanh toán", value: current.revenue, delta: delta("revenue"), spark: cashSpark() },
      { key: "expected", label: "Doanh thu dự kiến", value: current.expected, delta: delta("expected"), spark: sparkOf((b) => (b.status === "Đã xác nhận" && !isPaid(b) ? num(b.total_price) : 0)) },
      { key: "orders", label: "Tổng số đơn", value: current.orders, format: "number", delta: delta("orders"), spark: sparkOf(() => 1) },
      { key: "aov", label: "Giá trị đơn trung bình", value: current.aov, delta: delta("aov"), spark: sparkOf((b) => (b.status !== "Đã hủy" ? num(b.total_price) : 0)) },
      { key: "guests", label: "Tổng số khách", value: current.guests, format: "number", delta: delta("guests"), spark: sparkOf((b) => (b.status !== "Đã hủy" ? pax(b) : 0)) },
      { key: "activeTours", label: "Tour đang bán", value: tours.filter((tour) => !tour.archived && (tour.status || "Đang bán") === "Đang bán").length, format: "number", delta: 0, spark: [] },
      { key: "cancelRate", label: "Tỷ lệ hủy", value: current.cancelRate, format: "percent", delta: delta("cancelRate"), spark: sparkOf((b) => (b.status === "Đã hủy" ? 1 : 0)) },
      { key: "fillRate", label: "Tỷ lệ lấp đầy chỗ", value: current.fillRate, format: "percent", delta: delta("fillRate"), spark: [] },
      { key: "receivable", label: "Công nợ phải thu", value: current.receivable, delta: delta("receivable"), spark: sparkOf((b) => (b.status !== "Đã hủy" && !isPaid(b) ? num(b.total_price) : 0)) },
    ];

    const series = {
      day: seriesFor(scoped, payments, start, end, "day", shift),
      week: seriesFor(scoped, payments, start, end, "week", shift),
      month: seriesFor(scoped, payments, start, end, "month", shift),
      quarter: seriesFor(scoped, payments, start, end, "quarter", shift),
    };

    const groupTotals = { domestic: 0, international: 0, service: 0 };
    paidInRange.forEach((booking) => {
      const tour = toursById.get(booking.tour_id);
      if (!tour) groupTotals.service += cashOf(booking);
      else groupTotals[tour.scope === "international" ? "international" : "domestic"] += cashOf(booking);
    });
    const groups = [
      { name: GROUP_LABEL.domestic, value: groupTotals.domestic },
      { name: GROUP_LABEL.international, value: groupTotals.international },
      ...(groupTotals.service ? [{ name: "Dịch vụ khác", value: groupTotals.service }] : []),
    ];

    const tourStats = new Map();
    inRange.filter((booking) => booking.status !== "Đã hủy").forEach((booking) => {
      const tour = toursById.get(booking.tour_id);
      const entry = tourStats.get(booking.tour_id) || {
        id: booking.tour_id,
        name: tour?.title || booking.tour_title || "Tour",
        revenue: 0,
        guests: 0,
      };
      entry.revenue += cashOf(booking);
      entry.guests += pax(booking);
      tourStats.set(booking.tour_id, entry);
    });
    const topTours = [...tourStats.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const channelTotals = {};
    paidInRange.forEach((booking) => {
      const key = booking.channel || "Khác";
      channelTotals[key] = (channelTotals[key] || 0) + cashOf(booking);
    });
    const channels = Object.entries(channelTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const destinationTotals = {};
    paidInRange.forEach((booking) => {
      const tour = toursById.get(booking.tour_id);
      const key = tour?.destination || "Khác";
      destinationTotals[key] = (destinationTotals[key] || 0) + cashOf(booking);
    });
    const destinations = Object.entries(destinationTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const valid = inRange.filter((booking) => booking.status !== "Đã hủy");
    const confirmed = valid.filter((booking) => booking.status === "Đã xác nhận" || isPaid(booking));
    const funnel = [
      { step: "Yêu cầu đặt tour", value: inRange.length },
      { step: "Giữ chỗ hợp lệ", value: valid.length },
      { step: "Đã xác nhận", value: confirmed.length },
      { step: "Đã thanh toán", value: valid.filter(isPaid).length },
    ];

    const profitSeries = [];
    for (let i = 11; i >= 0; i -= 1) {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      const stats = summarize(scoped, toursById, departures, monthStart, monthEnd, payments);
      profitSeries.push({
        label: `T${monthStart.getMonth() + 1}`,
        revenue: stats.revenue,
        cost: stats.cost,
        profit: stats.profit,
      });
    }

    const now = new Date();
    const pendingOld = bookings.filter((booking) => {
      if (booking.status !== "Chờ xác nhận") return false;
      const created = bookingDate(booking);
      return created && now - created > 30 * 60 * 1000;
    }).length;
    const inSevenDays = addDays(now, 7);
    const upcoming = departures
      .filter((dep) => {
        const date = parse(dep.departure_date);
        return date && date >= startOfDay(now) && date <= inSevenDays && dep.status !== "Đã hủy";
      })
      .sort((a, b) => new Date(a.departure_date) - new Date(b.departure_date));

    const lowFill = upcoming.filter((dep) => num(dep.seats_total) > 0 && num(dep.seats_booked) < num(dep.seats_total) * 0.5).length;
    const nearFull = departures.filter((dep) => {
      const date = parse(dep.departure_date);
      return date && date >= startOfDay(now) && num(dep.seats_total) > 0 && num(dep.seats_booked) / num(dep.seats_total) >= 0.9;
    }).length;
    const overdue = bookings.filter((booking) => {
      if (isPaid(booking) || booking.status === "Đã hủy") return false;
      const created = bookingDate(booking);
      return created && now - created > 7 * 86400000;
    }).length;
    const refunds = payments.filter((row) => row.kind === "Hoàn tiền" && row.status === "Chờ duyệt hoàn").length;

    const alerts = [
      { key: "pending", label: "Đơn chờ xác nhận quá 30 phút", count: pendingOld, tone: "warning", to: "/admin/bookings" },
      { key: "lowFill", label: "Kỳ khởi hành ≤ 7 ngày lấp dưới 50%", count: lowFill, tone: "info", to: "/admin/departures" },
      { key: "nearFull", label: "Tour sắp hết chỗ", count: nearFull, tone: "danger", to: "/admin/departures" },
      { key: "overdue", label: "Thanh toán quá hạn", count: overdue, tone: "danger", to: "/admin/payments" },
      { key: "refunds", label: "Yêu cầu hủy / hoàn tiền", count: refunds, tone: "neutral", to: "/admin/refunds" },
    ];

    const latest = [...scoped]
      .sort((a, b) => (bookingDate(b)?.getTime() || 0) - (bookingDate(a)?.getTime() || 0))
      .slice(0, 8)
      .map((booking) => ({
        id: booking.id,
        code: booking.booking_code,
        customer: booking.customer_name,
        phone: booking.customer_phone,
        tour: booking.tour_title,
        pax: pax(booking),
        departure: booking.departure_date,
        created: booking.booking_date || booking.created_date,
        total: num(booking.total_price),
        status: booking.status,
        payment_status: booking.payment_status || "Unpaid",
        channel: booking.channel || "Khác",
      }));

    // Dịch vụ khác: doanh thu lấy từ sổ ThanhToan (mã YC-), cùng định nghĩa với doanh thu tour.
    const servicePayments = payments.filter((row) => String(row.booking_code || "").startsWith("YC-"));
    const serviceRevenue = cashIn(servicePayments, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)).net;
    const requestsInRange = serviceRequests.filter((row) => {
      const date = parse(row.created_date) || parse(row.use_date);
      return date && date >= start && date <= end;
    });
    const wonRequests = requestsInRange.filter((row) => ["Đã xác nhận", "Đã thanh toán", "Hoàn tất"].includes(row.status));
    const lostRequests = requestsInRange.filter((row) => row.status === "Hủy");
    const serviceTopMap = new Map();
    wonRequests.forEach((row) => {
      const entry = serviceTopMap.get(row.service_title) || { name: row.service_title, value: 0, count: 0 };
      entry.value += num(row.quoted_price);
      entry.count += 1;
      serviceTopMap.set(row.service_title, entry);
    });
    const serviceStats = {
      revenue: serviceRevenue,
      tourRevenue: Math.max(paidRevenueInRange - serviceRevenue, 0),
      mix: [
        { name: "Tour", value: Math.max(paidRevenueInRange - serviceRevenue, 0) },
        { name: "Dịch vụ", value: serviceRevenue },
      ],
      top: [...serviceTopMap.values()].sort((a, b) => b.value - a.value).slice(0, 5),
      pending: serviceRequests.filter((row) => row.status === "Mới").length,
      pendingOld: serviceRequests.filter(
        (row) => row.status === "Mới" && Date.now() - new Date(row.created_date || Date.now()).getTime() > 30 * 60 * 1000,
      ).length,
      conversion: wonRequests.length + lostRequests.length
        ? Math.round((wonRequests.length / (wonRequests.length + lostRequests.length)) * 1000) / 10
        : 0,
      count: requestsInRange.length,
    };
    alerts.push({
      key: "servicePending",
      label: "Yêu cầu dịch vụ chờ xử lý",
      count: serviceStats.pending,
      tone: serviceStats.pendingOld ? "warning" : "neutral",
      to: "/admin/service-requests",
    });

    const postsInRange = blogPosts.filter((post) => {
      const date = parse(post.published_at) || parse(post.created_date);
      return date && date >= start && date <= end && (post.status || "Đã đăng") === "Đã đăng";
    });
    const postBrief = (post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      category: post.category || "",
      views: num(post.view_count),
      orders: num(post.order_count),
      cta: num(post.cta_click_count),
    });
    const contentStats = {
      published: postsInRange.length,
      total: blogPosts.length,
      pending: blogPosts.filter((post) => post.status === "Chờ duyệt").length,
      views: blogPosts.reduce((sum, post) => sum + num(post.view_count), 0),
      orders: blogPosts.reduce((sum, post) => sum + num(post.order_count), 0),
      topViewed: [...blogPosts].sort((a, b) => num(b.view_count) - num(a.view_count)).slice(0, 5).map(postBrief),
      topOrders: [...blogPosts].sort((a, b) => num(b.order_count) - num(a.order_count)).slice(0, 5).map(postBrief),
    };

    return {
      range: { start: start.toISOString(), end: end.toISOString(), preset: data.range || "30d" },
      kpis,
      serviceStats,
      contentStats,
      current,
      previous,
      series,
      groups,
      topTours,
      channels,
      destinations,
      funnel,
      profitSeries,
      alerts,
      upcoming: upcoming.slice(0, 8).map((dep) => ({
        id: dep.id,
        tour: dep.tour_title,
        date: dep.departure_date,
        booked: num(dep.seats_booked),
        total: num(dep.seats_total),
        guide: dep.guide_name,
        status: dep.status,
      })),
      latest,
      paidCount: paidInRange.length,
      paidRevenue: paidRevenueInRange,
      options: {
        destinations: [...new Set(tours.map((tour) => tour.destination).filter(Boolean))].sort(),
        sales: [...new Set(bookings.map((booking) => booking.sale_owner).filter(Boolean))].sort(),
        channels: [...new Set(["Website", "Facebook", "Zalo", "Hotline", "Đại lý", "Walk-in"])],
      },
    };
  });

export const searchAdmin = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string().trim().min(1).max(60) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const regex = data.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const [bookingsRes, customersRes, toursRes] = await Promise.all([
      base44.entities.Booking.filter(
        { $or: [{ booking_code: { $regex: regex } }, { customer_name: { $regex: regex } }, { customer_phone: { $regex: regex } }] },
        { limit: 5 },
      ),
      base44.entities.Customer.filter(
        { $or: [{ full_name: { $regex: regex } }, { phone: { $regex: regex } }] },
        { limit: 5 },
      ),
      base44.entities.Tour.filter({ title: { $regex: regex } }, { limit: 5 }),
    ]);
    return {
      bookings: asArray(bookingsRes).map((item) => ({ id: item.id, code: item.booking_code, name: item.customer_name, tour: item.tour_title, total: num(item.total_price) })),
      customers: asArray(customersRes).map((item) => ({ id: item.id, name: item.full_name, phone: item.phone, city: item.city })),
      tours: asArray(toursRes).map((item) => ({ id: item.id, name: item.title, slug: item.slug, scope: item.scope })),
    };
  });

export const createAdminBooking = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator(
    z.object({
      tour_id: z.string().min(1).max(64),
      customer_name: z.string().trim().min(2).max(80),
      customer_phone: z.string().trim().min(8).max(20),
      customer_email: z.string().trim().max(120).optional(),
      departure_id: z.string().max(64).optional(),
      departure_date: z.string().min(8).max(30),
      adults_count: z.number().int().min(1).max(60),
      children_count: z.number().int().min(0).max(40),
      infants_count: z.number().int().min(0).max(20).optional(),
      channel: z.enum(["Website", "Facebook", "Zalo", "Hotline", "Đại lý", "Walk-in", "Trực tiếp"]),
      sale_owner: z.string().trim().max(60).optional(),
      voucher_code: z.string().trim().max(40).optional(),
      note: z.string().trim().max(500).optional(),
      internal_note: z.string().trim().max(500).optional(),
      addons: z
        .array(z.object({ service_id: z.string().max(64), quantity: z.number().int().min(1).max(50) }))
        .max(10)
        .optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44().asServiceRole;
    const tour = await base44.entities.Tour.get(data.tour_id);
    if (!tour) return { error: "Không tìm thấy tour đã chọn." };

    // Giữ nguyên công thức tính tiền hiện hành: giá NL sau giảm × số NL + giá TE × số TE.
    const adultUnit =
      num(tour.discount_percent) > 0
        ? Math.round((num(tour.price_adult) * (100 - num(tour.discount_percent))) / 100)
        : num(tour.price_adult);
    const childUnit = num(tour.price_child);
    const infantUnit = num(tour.price_infant);
    const tourTotal = adultUnit * data.adults_count + childUnit * data.children_count;

    // Dịch vụ đi kèm (vé tham quan, khách sạn, đưa đón…) tính vào tổng tiền như một dòng riêng.
    const addons = [];
    for (const item of data.addons || []) {
      const service = await base44.entities.Service.get(item.service_id);
      if (!service) continue;
      const unitPrice = num(service.price) || num(service.price_from);
      addons.push({
        service_id: service.id,
        service_title: service.title,
        quantity: item.quantity,
        unit_price: unitPrice,
        amount: unitPrice * item.quantity,
      });
    }
    const addonTotal = addons.reduce((sum, item) => sum + item.amount, 0);
    const total = tourTotal + addonTotal;

    const code = await nextBookingCode(base44);
    const customerId = await syncCustomer(base44, {
      name: data.customer_name,
      phone: data.customer_phone,
      email: data.customer_email,
      channel: data.channel,
      owner: data.sale_owner,
    });

    const booking = await base44.entities.Booking.create({
      booking_code: code,
      booking_date: new Date().toISOString(),
      tour_id: tour.id,
      tour_title: tour.title,
      customer_id: customerId || "",
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email || "",
      departure_id: data.departure_id || "",
      departure_date: data.departure_date,
      adults_count: data.adults_count,
      children_count: data.children_count,
      infants_count: data.infants_count || 0,
      unit_price_adult: adultUnit,
      unit_price_child: childUnit,
      unit_price_infant: infantUnit,
      discount_percent: num(tour.discount_percent),
      total_price: total,
      service_amount: addonTotal,
      addons,
      paid_amount: 0,
      special_requests: data.note || "",
      customer_note: data.note || "",
      voucher_code: data.voucher_code || "",
      channel: data.channel,
      sale_owner: data.sale_owner || "",
      status: "Chờ xác nhận",
      payment_status: "Unpaid",
      passengers: [
        { full_name: data.customer_name, type: "Người lớn" },
        ...Array.from({ length: data.children_count }, () => ({ full_name: "Trẻ em", type: "Trẻ em" })),
        ...Array.from({ length: data.infants_count || 0 }, () => ({ full_name: "Em bé", type: "Em bé" })),
      ],
      activities: [
        {
          at: new Date().toISOString(),
          type: "created",
          text: `Đơn được tạo thủ công · nguồn ${data.channel}`,
          actor: "Quản trị viên",
        },
      ],
      internal_notes: data.internal_note
        ? [{ at: new Date().toISOString(), author: "Quản trị viên", text: data.internal_note }]
        : [],
    });
    return { booking_code: booking.booking_code, total_price: total, customer_id: customerId || "" };
  });