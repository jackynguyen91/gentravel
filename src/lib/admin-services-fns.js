import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_SERVICE_TYPES, parseLegacyPrice, suggestedPrice } from "@/lib/service-catalog";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const num = (value) => Number(value) || 0;
const slugify = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const DESTINATION_SEED = [
  { name: "Hà Nội", region: "Miền Bắc", country: "Việt Nam" },
  { name: "Hạ Long", region: "Miền Bắc", country: "Việt Nam" },
  { name: "Sa Pa", region: "Miền Bắc", country: "Việt Nam" },
  { name: "Ninh Bình", region: "Miền Bắc", country: "Việt Nam" },
  { name: "Đà Nẵng", region: "Miền Trung", country: "Việt Nam" },
  { name: "Hội An", region: "Miền Trung", country: "Việt Nam" },
  { name: "Huế", region: "Miền Trung", country: "Việt Nam" },
  { name: "Nha Trang", region: "Miền Trung", country: "Việt Nam" },
  { name: "Quy Nhơn", region: "Miền Trung", country: "Việt Nam" },
  { name: "Đà Lạt", region: "Miền Nam", country: "Việt Nam" },
  { name: "Phú Quốc", region: "Miền Nam", country: "Việt Nam" },
  { name: "TP. Hồ Chí Minh", region: "Miền Nam", country: "Việt Nam" },
  { name: "Phan Thiết", region: "Miền Nam", country: "Việt Nam" },
  { name: "Cần Thơ", region: "Miền Nam", country: "Việt Nam" },
  { name: "Nhật Bản", region: "Quốc tế", country: "Nhật Bản" },
  { name: "Hàn Quốc", region: "Quốc tế", country: "Hàn Quốc" },
  { name: "Đài Loan", region: "Quốc tế", country: "Đài Loan" },
  { name: "Thái Lan", region: "Quốc tế", country: "Thái Lan" },
  { name: "Singapore", region: "Quốc tế", country: "Singapore" },
  { name: "Trung Quốc", region: "Quốc tế", country: "Trung Quốc" },
  { name: "Châu Âu", region: "Quốc tế", country: "Châu Âu" },
];

const ALIASES = {
  "sài gòn": "TP. Hồ Chí Minh",
  "hồ chí minh": "TP. Hồ Chí Minh",
  "tp hcm": "TP. Hồ Chí Minh",
  hcm: "TP. Hồ Chí Minh",
  "vịnh hạ long": "Hạ Long",
  "vinh ha long": "Hạ Long",
  sapa: "Sa Pa",
  "đà lạt": "Đà Lạt",
  dalat: "Đà Lạt",
  "phú quốc": "Phú Quốc",
  phuquoc: "Phú Quốc",
  "nha trang": "Nha Trang",
  "đà nẵng": "Đà Nẵng",
  danang: "Đà Nẵng",
  "hà nội": "Hà Nội",
  hanoi: "Hà Nội",
  "nhật bản": "Nhật Bản",
  japan: "Nhật Bản",
  tokyo: "Nhật Bản",
  osaka: "Nhật Bản",
  "hàn quốc": "Hàn Quốc",
  korea: "Hàn Quốc",
  seoul: "Hàn Quốc",
  "đài loan": "Đài Loan",
  "đài bắc": "Đài Loan",
  taiwan: "Đài Loan",
  "thái lan": "Thái Lan",
  bangkok: "Thái Lan",
  "trung quốc": "Trung Quốc",
  "châu âu": "Châu Âu",
  europe: "Châu Âu",
  "hội an": "Hội An",
  hoian: "Hội An",
  huế: "Huế",
  "quy nhơn": "Quy Nhơn",
  "ninh bình": "Ninh Bình",
  "phan thiết": "Phan Thiết",
  "cần thơ": "Cần Thơ",
};

export function matchDestination(text) {
  const haystack = String(text || "").toLowerCase();
  if (!haystack) return null;
  const alias = Object.keys(ALIASES).find((key) => haystack.includes(key));
  if (alias) return ALIASES[alias];
  const direct = DESTINATION_SEED.find((item) => haystack.includes(item.name.toLowerCase()));
  return direct ? direct.name : null;
}

function serviceDefaults(service) {
  const parsed = parseLegacyPrice(service);
  const destination = service.destination || matchDestination(`${service.title} ${service.summary}`) || "";
  const active = service.status ? service.status === "Đang hiển thị" : service.is_active !== false;
  return {
    ...parsed,
    status: service.status || (service.is_active === false ? "Ẩn" : "Đang hiển thị"),
    is_active: active,
    archived: service.archived === true,
    sort_order: Number.isFinite(Number(service.sort_order)) ? Number(service.sort_order) : 0,
    pinned: service.pinned === true,
    view_count_30d: num(service.view_count_30d),
    destination,
    needs_review: service.needs_review ?? (!destination || parsed.price_needs_review),
    price_rules: Array.isArray(service.price_rules) ? service.price_rules : [],
    seasonal_prices: Array.isArray(service.seasonal_prices) ? service.seasonal_prices : [],
    images: Array.isArray(service.images) && service.images.length ? service.images : service.image ? [service.image] : [],
  };
}

export const listServicesAdmin = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const base44 = context.getBase44();
  const [serviceRows, requestRows, settingRows] = await Promise.all([
    base44.entities.Service.list({ sort: "sort_order", limit: 300 }),
    base44.entities.ServiceRequest.list({ limit: 1000 }),
    base44.entities.Setting.list({ limit: 1 }),
  ]);
  const services = asArray(serviceRows).map((service) => ({ ...service, ...serviceDefaults(service) }));
  const requests = asArray(requestRows);
  const stats = {};
  requests.forEach((request) => {
    const key = request.service_id || "";
    const entry = stats[key] || { count: 0, revenue: 0 };
    entry.count += 1;
    if (["Đã xác nhận", "Đã thanh toán", "Hoàn tất"].includes(request.status)) {
      entry.revenue += num(request.quoted_price);
    }
    stats[key] = entry;
  });
  const setting = asArray(settingRows)[0] || {};
  const types = Array.isArray(setting.service_types) && setting.service_types.length
    ? setting.service_types.filter((item) => item?.active !== false).map((item) => item.name)
    : DEFAULT_SERVICE_TYPES;

  return {
    services: services.map((service) => ({
      ...service,
      request_count: stats[service.id]?.count || 0,
      revenue: stats[service.id]?.revenue || 0,
    })),
    types,
    destinations: [...new Set([...DESTINATION_SEED.map((item) => item.name), ...services.map((item) => item.destination).filter(Boolean)])].sort(),
  };
});

const serviceInput = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(180).optional(),
  type: z.string().trim().min(1).max(60),
  summary: z.string().max(600).optional(),
  description: z.string().max(6000).optional(),
  highlights: z.array(z.string().max(300)).max(20).optional(),
  image: z.string().max(600).optional(),
  images: z.array(z.string().max(600)).max(12).optional(),
  destination: z.string().max(120).optional(),
  status: z.string().max(40).optional(),
  sort_order: z.number().optional(),
  price: z.number().min(0).optional(),
  price_unit: z.string().max(40).optional(),
  price_kind: z.string().max(60).optional(),
  price_includes_tax: z.boolean().optional(),
  price_note: z.string().max(300).optional(),
  price_needs_review: z.boolean().optional(),
  price_rules: z
    .array(
      z.object({
        audience: z.string().max(40),
        basis: z.string().max(40).optional(),
        min_value: z.number().optional(),
        max_value: z.number().optional(),
        discount_percent: z.number().optional(),
        note: z.string().max(200).optional(),
      }),
    )
    .max(12)
    .optional(),
  seasonal_prices: z
    .array(
      z.object({
        label: z.string().max(120),
        from_date: z.string().max(20).optional(),
        to_date: z.string().max(20).optional(),
        price: z.number().optional(),
      }),
    )
    .max(24)
    .optional(),
  cost_price: z.number().min(0).optional(),
  markup_percent: z.number().min(0).max(1000).optional(),
  service_fee: z.number().min(0).optional(),
  supplier_id: z.string().max(64).optional(),
  supplier_name: z.string().max(160).optional(),
  flight: z.record(z.string(), z.any()).optional(),
  ticket: z.record(z.string(), z.any()).optional(),
  hotel: z.record(z.string(), z.any()).optional(),
  visa: z.record(z.string(), z.any()).optional(),
  transport: z.record(z.string(), z.any()).optional(),
  seo_title: z.string().max(200).optional(),
  seo_description: z.string().max(320).optional(),
});

export const saveService = createServerFn({ method: "POST" })
  .validator(serviceInput)
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const { id, ...rest } = data;
    const price = num(rest.price) || suggestedPrice(rest);
    const payload = {
      ...rest,
      price,
      price_from: price,
      slug: rest.slug?.trim() || slugify(rest.title),
      status: rest.status || "Đang hiển thị",
      is_active: (rest.status || "Đang hiển thị") === "Đang hiển thị",
      image: rest.image || rest.images?.[0] || "",
    };
    if (id) {
      await base44.entities.Service.update(id, payload);
      return { id };
    }
    const created = await base44.entities.Service.create({ ...payload, sort_order: num(rest.sort_order) });
    return { id: created.id };
  });

export const setServiceStatus = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), status: z.string().max(40) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    await base44.entities.Service.update(data.id, {
      status: data.status,
      is_active: data.status === "Đang hiển thị",
    });
    return { ok: true };
  });

export const setServicePinned = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), pinned: z.boolean() }))
  .handler(async ({ data, context }) => {
    await context.getBase44().entities.Service.update(data.id, { pinned: data.pinned });
    return { ok: true };
  });

export const archiveService = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), archived: z.boolean().optional() }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const archived = data.archived !== false;
    await base44.entities.Service.update(data.id, {
      archived,
      status: archived ? "Ẩn" : "Đang hiển thị",
      is_active: !archived,
    });
    return { ok: true };
  });

export const hardDeleteService = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const requests = asArray(await base44.entities.ServiceRequest.filter({ service_id: data.id }, { limit: 1 }));
    if (requests.length) return { error: "Dịch vụ đã có yêu cầu nên không xóa cứng được. Hãy lưu trữ." };
    const bookings = asArray(await base44.entities.Booking.list({ limit: 1000 }));
    const used = bookings.some((booking) => (booking.addons || []).some((item) => item.service_id === data.id));
    if (used) return { error: "Dịch vụ đã dùng trong đơn tour nên không xóa cứng được. Hãy lưu trữ." };
    await base44.entities.Service.delete(data.id);
    return { ok: true };
  });

export const duplicateService = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const source = await base44.entities.Service.get(data.id);
    const copy = {
      ...source,
      title: `${source.title} (bản sao)`,
      slug: `${source.slug || slugify(source.title)}-copy-${Date.now().toString().slice(-4)}`,
      status: "Nháp",
      is_active: false,
      pinned: false,
      archived: false,
    };
    delete copy.id;
    delete copy.created_date;
    delete copy.updated_date;
    delete copy.created_by_id;
    const created = await base44.entities.Service.create(copy);
    return { id: created.id };
  });

export const reorderServices = createServerFn({ method: "POST" })
  .validator(z.object({ order: z.array(z.object({ id: z.string(), sort_order: z.number() })).max(300) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    await base44.entities.Service.bulkUpdate(data.order);
    return { ok: true };
  });

/** Chuẩn hóa dữ liệu cũ: tách giá, gán điểm đến, bổ sung trường mặc định. */
export const normalizeServices = createServerFn({ method: "POST" }).handler(async ({ context }) => {
  const base44 = context.getBase44();
  const rows = asArray(await base44.entities.Service.list({ limit: 300 }));
  const patches = rows.map((service, index) => {
    const defaults = serviceDefaults(service);
    return {
      id: service.id,
      ...defaults,
      sort_order: service.sort_order ?? index,
    };
  });
  if (!patches.length) return { updated: 0, needsReview: 0 };
  for (let i = 0; i < patches.length; i += 100) {
    await base44.entities.Service.bulkUpdate(patches.slice(i, i + 100));
  }
  return {
    updated: patches.length,
    needsReview: patches.filter((item) => item.needs_review).length,
  };
});

/** Tạo danh mục điểm đến dùng chung và gán cho tour + dịch vụ theo tên. */
export const syncDestinations = createServerFn({ method: "POST" }).handler(async ({ context }) => {
  const base44 = context.getBase44();
  const [existingRows, tourRows, serviceRows] = await Promise.all([
    base44.entities.Destination.list({ limit: 300 }),
    base44.entities.Tour.list({ limit: 300 }),
    base44.entities.Service.list({ limit: 300 }),
  ]);
  const existing = asArray(existingRows);
  const byName = new Map(existing.map((item) => [item.name.toLowerCase(), item]));
  const created = [];
  for (const destination of DESTINATION_SEED) {
    if (byName.has(destination.name.toLowerCase())) continue;
    const row = await base44.entities.Destination.create({
      ...destination,
      slug: slugify(destination.name),
      description: "",
    });
    byName.set(destination.name.toLowerCase(), row);
    created.push(row);
  }

  const tourPatches = asArray(tourRows)
    .map((tour) => {
      const name = tour.destination || matchDestination(`${tour.title} ${tour.destination || ""}`);
      return { tour, name };
    })
    .filter(({ tour, name }) => name && tour.destination !== name)
    .map(({ tour, name }) => ({ id: tour.id, destination: name }));

  const servicePatches = asArray(serviceRows)
    .map((service) => ({ service, name: service.destination || matchDestination(`${service.title} ${service.summary || ""}`) }))
    .filter(({ service, name }) => name !== service.destination || service.needs_review === undefined)
    .map(({ service, name }) => ({
      id: service.id,
      destination: name || "",
      destination_id: name ? byName.get(name.toLowerCase())?.id || "" : "",
      needs_review: !name,
    }));

  if (tourPatches.length) await base44.entities.Tour.bulkUpdate(tourPatches.slice(0, 500));
  if (servicePatches.length) await base44.entities.Service.bulkUpdate(servicePatches.slice(0, 500));

  return {
    destinations: asArray(await base44.entities.Destination.list({ limit: 300 })).length,
    created: created.length,
    toursUpdated: tourPatches.length,
    servicesUpdated: servicePatches.length,
  };
});

export const listDestinations = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const rows = asArray(await context.getBase44().entities.Destination.list({ sort: "name", limit: 300 }));
  return rows;
});

export const saveDestination = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(120),
      country: z.string().max(120).optional(),
      region: z.string().max(40).optional(),
      image: z.string().max(600).optional(),
      description: z.string().max(600).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const payload = { ...data, slug: slugify(data.name), needs_review: false };
    delete payload.id;
    if (data.id) {
      await base44.entities.Destination.update(data.id, payload);
      return { id: data.id };
    }
    const created = await base44.entities.Destination.create(payload);
    return { id: created.id };
  });