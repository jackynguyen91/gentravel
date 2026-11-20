import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { nextBookingCode } from "@/lib/booking-code";
import { syncCustomer } from "@/lib/customer-sync";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const num = (value) => Number(value) || 0;

async function nextRequestCode(base44) {
  const now = new Date();
  const prefix = `YC-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rows = asArray(await base44.entities.ServiceRequest.filter({ request_code: { $regex: `^${prefix}` } }, { limit: 500 }));
  const max = rows.reduce((highest, row) => {
    const tail = Number(String(row.request_code).split("-").pop());
    return Number.isFinite(tail) && tail > highest ? tail : highest;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export const listServiceRequests = createServerFn({ method: "GET" }).handler(async ({ context }) => {
  const base44 = context.getBase44();
  const rows = asArray(await base44.entities.ServiceRequest.list({ sort: "-created_date", limit: 500 }));
  const counts = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
  const now = Date.now();
  const pendingOld = rows.filter(
    (row) => row.status === "Mới" && now - new Date(row.created_date || Date.now()).getTime() > 30 * 60 * 1000,
  ).length;
  return {
    requests: rows,
    counts: { all: rows.length, ...counts },
    pendingOld,
    revenue: rows
      .filter((row) => ["Đã xác nhận", "Đã thanh toán", "Hoàn tất"].includes(row.status))
      .reduce((sum, row) => sum + num(row.quoted_price), 0),
    won: rows.filter((row) => ["Đã xác nhận", "Đã thanh toán", "Hoàn tất"].includes(row.status)).length,
    lost: rows.filter((row) => row.status === "Hủy").length,
  };
});

const requestInput = z.object({
  service_id: z.string().max(64).optional(),
  service_title: z.string().trim().min(2).max(160),
  service_type: z.string().max(60).optional(),
  customer_name: z.string().trim().min(2).max(80),
  customer_phone: z.string().trim().min(8).max(20),
  customer_email: z.string().trim().max(120).optional(),
  use_date: z.string().max(20).optional(),
  end_date: z.string().max(20).optional(),
  adults_count: z.number().int().min(0).max(60).optional(),
  children_count: z.number().int().min(0).max(60).optional(),
  content: z.string().max(1000).optional(),
  channel: z.string().max(30).optional(),
  source_post: z.string().max(200).optional(),
  sale_owner: z.string().max(60).optional(),
  quoted_price: z.number().min(0).optional(),
  cost_price: z.number().min(0).optional(),
});

export const createServiceRequest = createServerFn({ method: "POST" })
  .validator(requestInput)
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const code = await nextRequestCode(base44);
    let sourceTitle = "";
    if (data.source_post) {
      const posts = asArray(await base44.entities.BlogPost.filter({ slug: data.source_post }, { limit: 1 }));
      sourceTitle = posts[0]?.title || "";
    }
    const channel = sourceTitle ? "Bài viết" : data.channel || "Hotline";
    const customerId = await syncCustomer(base44, {
      name: data.customer_name,
      phone: data.customer_phone,
      email: data.customer_email,
      channel,
      owner: data.sale_owner,
    });
    const created = await base44.entities.ServiceRequest.create({
      ...data,
      channel,
      source_post_title: sourceTitle,
      request_code: code,
      customer_id: customerId || "",
      adults_count: data.adults_count ?? 1,
      children_count: data.children_count ?? 0,
      quoted_price: num(data.quoted_price),
      cost_price: num(data.cost_price),
      status: "Mới",
      activities: [
        {
          at: new Date().toISOString(),
          type: "created",
          text: `Tạo yêu cầu · nguồn ${channel}${sourceTitle ? ` (${sourceTitle})` : ""}`,
          actor: data.sale_owner || "Quản trị viên",
        },
      ],
      notes: [],
    });
    return { id: created.id, request_code: created.request_code };
  });

export const updateServiceRequest = createServerFn({ method: "POST" })
  .validator(requestInput.partial().extend({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    await context.getBase44().entities.ServiceRequest.update(id, patch);
    return { ok: true };
  });

export const changeRequestStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      status: z.string().max(40),
      reason: z.string().max(300).optional(),
      actor: z.string().max(120).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const current = await base44.entities.ServiceRequest.get(data.id);
    const activity = {
      at: new Date().toISOString(),
      type: "status",
      from: current.status,
      to: data.status,
      text: data.status === "Hủy" ? `Hủy yêu cầu: ${data.reason || "không ghi lý do"}` : `Chuyển sang ${data.status}`,
      actor: data.actor || "Quản trị viên",
    };
    await base44.entities.ServiceRequest.update(data.id, {
      status: data.status,
      cancel_reason: data.status === "Hủy" ? data.reason || "" : current.cancel_reason || "",
      activities: [...(current.activities || []), activity],
    });
    return { ok: true };
  });

export const addRequestNote = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), text: z.string().trim().min(1).max(600), author: z.string().max(120).optional() }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const current = await base44.entities.ServiceRequest.get(data.id);
    await base44.entities.ServiceRequest.update(data.id, {
      notes: [...(current.notes || []), { at: new Date().toISOString(), author: data.author || "Quản trị viên", text: data.text }],
    });
    return { ok: true };
  });

/** Gửi báo giá PDF (do trình duyệt tạo) cho khách qua email. */
export const sendServiceQuoteEmail = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      to: z.string().trim().email().max(120),
      subject: z.string().trim().max(200),
      html: z.string().max(20000),
      filename: z.string().max(120),
      pdf_base64: z.string().max(6_000_000),
      actor: z.string().max(120).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const request = await base44.entities.ServiceRequest.get(data.id);
    await base44.integrations.Core.SendEmail({
      to: data.to,
      subject: data.subject,
      html: data.html,
      attachments: [{ filename: data.filename, content: data.pdf_base64 }],
    });
    const activity = {
      at: new Date().toISOString(),
      type: "quote_sent",
      text: `Đã gửi báo giá tới ${data.to}`,
      actor: data.actor || "Quản trị viên",
    };
    await base44.entities.ServiceRequest.update(data.id, {
      status: request.status === "Mới" || request.status === "Đã liên hệ" ? "Đã báo giá" : request.status,
      activities: [...(request.activities || []), activity],
    });
    return { ok: true };
  });

/** Ghi nhận thanh toán dịch vụ vào sổ ThanhToan (dùng chung định nghĩa doanh thu). */
export const recordServicePayment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string(),
      amount: z.number().min(1),
      method: z.string().max(40).optional(),
      kind: z.string().max(40).optional(),
      note: z.string().max(300).optional(),
      actor: z.string().max(120).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const request = await base44.entities.ServiceRequest.get(data.id);
    await base44.entities.Payment.create({
      direction: "Thu từ khách",
      booking_code: request.request_code,
      booking_id: request.id,
      customer_name: request.customer_name,
      amount: data.amount,
      kind: data.kind || "Thanh toán toàn bộ",
      method: data.method || "Chuyển khoản",
      status: "Đã thanh toán",
      paid_at: new Date().toISOString(),
      confirmed_by: data.actor || "Quản trị viên",
      note: data.note || `Dịch vụ ${request.service_title}`,
      reconciled: false,
    });
    const activity = {
      at: new Date().toISOString(),
      type: "payment",
      text: `Ghi nhận thanh toán ${data.amount.toLocaleString("vi-VN")}₫`,
      actor: data.actor || "Quản trị viên",
    };
    await base44.entities.ServiceRequest.update(request.id, {
      status: "Đã thanh toán",
      activities: [...(request.activities || []), activity],
    });
    return { ok: true };
  });

export const requestPayments = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string().max(40) }))
  .handler(async ({ data, context }) => {
    const rows = asArray(await context.getBase44().entities.Payment.filter({ booking_code: data.code }, { limit: 50 }));
    return rows;
  });