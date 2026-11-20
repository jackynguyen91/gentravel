import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { can, roleOf } from "@/lib/roles";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const canManage = (user) => ["Admin", "Quản lý", "Content"].includes(roleOf(user)) || can(user, "marketing");

export const listMediaAssets = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const rows = asArray(await context.getBase44().asServiceRole.entities.MediaAsset.list({ sort: "-created_date", limit: 400 }));
    return { assets: rows, canManage: canManage(context.user) };
  });

export const saveMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().optional(),
      url: z.string().trim().min(4).max(1000),
      name: z.string().max(200).optional(),
      alt: z.string().max(300).optional(),
      size_bytes: z.number().min(0).optional(),
      note: z.string().max(300).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!canManage(context.user)) return { error: "Bạn không có quyền quản lý thư viện ảnh." };
    const base44 = context.getBase44().asServiceRole;
    const payload = {
      url: data.url,
      name: data.name || data.url.split("/").pop() || "Ảnh",
      alt: data.alt || "",
      size_bytes: data.size_bytes || 0,
      note: data.note || "",
    };
    if (data.id) {
      await base44.entities.MediaAsset.update(data.id, payload);
      return { id: data.id };
    }
    const created = await base44.entities.MediaAsset.create(payload);
    return { id: created.id };
  });

export const bulkAltMedia = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(200), alt: z.string().trim().max(300) }))
  .handler(async ({ data, context }) => {
    if (!canManage(context.user)) return { error: "Bạn không có quyền quản lý thư viện ảnh." };
    const base44 = context.getBase44().asServiceRole;
    const patches = data.ids.map((id, index) => ({
      id,
      alt: data.ids.length > 1 ? `${data.alt} ${index + 1}` : data.alt,
    }));
    await base44.entities.MediaAsset.bulkUpdate(patches);
    return { updated: patches.length };
  });

export const deleteMediaAsset = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    if (!["Admin", "Quản lý"].includes(roleOf(context.user))) return { error: "Chỉ Quản lý hoặc Admin được xóa ảnh." };
    await context.getBase44().asServiceRole.entities.MediaAsset.delete(data.id);
    return { ok: true };
  });