import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { REFUND_KIND, REFUND_PENDING } from "@/lib/payment-utils";

const forbidden = () => Object.assign(new Error("Forbidden"), { status: 403, code: "FORBIDDEN" });
const actorOf = (context) => context.user?.full_name || context.user?.email || "";

const canApprove = (user) => user?.role === "admin" || user?.vai_tro === "Quản lý" || user?.staff_role === "Quản lý";

/** Quản lý/Admin duyệt hoặc từ chối yêu cầu hoàn tiền. */
export const decideRefund = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      payment_id: z.string().min(1).max(64),
      approve: z.boolean(),
      note: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!canApprove(context.user)) throw forbidden();
    const base44 = context.getBase44();
    const payment = await base44.entities.Payment.get(data.payment_id);
    if (!payment || payment.kind !== REFUND_KIND) return { error: "Không tìm thấy yêu cầu hoàn tiền." };
    if (payment.status !== REFUND_PENDING) return { error: "Yêu cầu này đã được xử lý." };

    const actor = actorOf(context);
    await base44.entities.Payment.update(payment.id, {
      status: data.approve ? "Đã hoàn tiền" : "Thất bại",
      confirmed_by: actor,
      paid_at: data.approve ? new Date().toISOString() : payment.paid_at || "",
      note: [payment.note, data.note].filter(Boolean).join(" · "),
    });

    await base44.entities.ActivityLog.create({
      module: "Thanh toán",
      action: data.approve ? "Duyệt hoàn tiền" : "Từ chối hoàn tiền",
      detail: `${payment.booking_code || ""} · ${Math.abs(Number(payment.amount) || 0).toLocaleString("vi-VN")}₫`,
      entity_id: payment.id,
      actor,
    });

    return { ok: true, status: data.approve ? "Đã hoàn tiền" : "Thất bại" };
  });

/** Đánh dấu đã đối soát hàng loạt. */
export const bulkReconcile = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(500) }))
  .handler(async ({ data, context }) => {
    const base44 = context.getBase44();
    const service = base44.asServiceRole;
    let updated = 0;
    for (const id of data.ids) {
      const payment = await base44.entities.Payment.get(id).catch(() => null);
      if (!payment) continue;
      await service.entities.Payment.update(id, { reconciled: true, reconciled_at: new Date().toISOString() });
      updated += 1;
    }
    await base44.entities.ActivityLog.create({
      module: "Thanh toán",
      action: "Đối soát hàng loạt",
      detail: `${updated} giao dịch`,
      actor: actorOf(context),
    });
    return { updated };
  });