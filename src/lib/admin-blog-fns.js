import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { can, roleOf } from "@/lib/roles";
import { countWords, DEFAULT_CATEGORIES, plainContent, readMinutes, seoChecks, statusOf } from "@/lib/blog-catalog";
import { slugify } from "@/lib/slugify";

const asArray = (result) => (Array.isArray(result) ? result : (result?.items ?? []));
const canApprove = (user) => ["Admin", "Quản lý"].includes(roleOf(user));
const canWrite = (user) => can(user, "marketing");

async function logAction(base44, user, action, detail, entityId) {
  try {
    await base44.entities.ActivityLog.create({
      module: "Bài viết",
      action,
      detail,
      entity_id: entityId || "",
      actor: user?.full_name || user?.email || "Quản trị viên",
    });
  } catch {
    // nhật ký lỗi không chặn thao tác chính
  }
}

async function ensureCategories(base44) {
  const rows = asArray(await base44.entities.BlogCategory.list({ sort: "sort_order", limit: 100 }));
  if (rows.length) return rows;
  const seeded = await base44.entities.BlogCategory.bulkCreate(
    DEFAULT_CATEGORIES.map((name, index) => ({ name, slug: slugify(name), sort_order: index, active: true })),
  );
  return asArray(seeded);
}

export const listBlogAdmin = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const base44 = context.getBase44();
    const [postRows, categoryRows, tourRows, serviceRows, destinationRows] = await Promise.all([
      base44.entities.BlogPost.list({ sort: "-created_date", limit: 400 }),
      ensureCategories(base44),
      base44.entities.Tour.list({ limit: 300 }),
      base44.entities.Service.list({ limit: 300 }),
      base44.entities.Destination.list({ sort: "name", limit: 300 }),
    ]);

    const posts = asArray(postRows).map((post) => {
      const words = post.word_count || countWords(plainContent(post));
      return {
        ...post,
        status: statusOf(post),
        word_count: words,
        read_minutes: post.read_minutes || readMinutes(words),
        view_count: Number(post.view_count) || 0,
        cta_click_count: Number(post.cta_click_count) || 0,
        order_count: Number(post.order_count) || 0,
      };
    });

    const tours = asArray(tourRows).filter((tour) => !tour.archived);
    const services = asArray(serviceRows).filter((service) => !service.archived);
    return {
      posts,
      categories: asArray(categoryRows),
      activeCategories: asArray(categoryRows).filter((item) => item.active !== false).map((item) => item.name),
      options: {
        authors: [...new Set(posts.map((post) => post.author).filter(Boolean))].sort(),
        destinations: asArray(destinationRows).map((item) => item.name),
        tours: tours.map((tour) => ({ id: tour.id, title: tour.title, slug: tour.slug, destination: tour.destination })),
        services: services.map((service) => ({ id: service.id, title: service.title, type: service.type, destination: service.destination })),
      },
      canApprove: canApprove(context.user),
      canWrite: canWrite(context.user),
      userId: context.user.id,
    };
  });

const postInput = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().max(220).optional(),
  summary: z.string().max(1200).optional(),
  thumbnail: z.string().max(1000).optional(),
  thumbnail_alt: z.string().max(300).optional(),
  category: z.string().max(80).optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  destination: z.string().max(120).optional(),
  destination_id: z.string().max(64).optional(),
  author: z.string().max(120).optional(),
  published_at: z.string().max(30).optional(),
  scheduled_at: z.string().max(30).optional(),
  featured: z.boolean().optional(),
  comments_enabled: z.boolean().optional(),
  status: z.string().max(30).optional(),
  meta_title: z.string().max(200).optional(),
  meta_description: z.string().max(400).optional(),
  og_image: z.string().max(1000).optional(),
  canonical_url: z.string().max(500).optional(),
  noindex: z.boolean().optional(),
  content_html: z.string().max(400000).optional(),
  content: z.string().max(400000).optional(),
  gallery_images: z.array(z.string().max(1000)).max(12).optional(),
  related_tour_ids: z.array(z.string().max(64)).max(12).optional(),
  related_service_ids: z.array(z.string().max(64)).max(12).optional(),
});

async function uniqueSlug(base44, desired, excludeId) {
  const base = slugify(desired) || `bai-viet-${Date.now().toString().slice(-5)}`;
  let candidate = base;
  for (let i = 2; i < 60; i += 1) {
    const rows = asArray(await base44.entities.BlogPost.filter({ slug: candidate }, { limit: 5 }));
    if (!rows.some((row) => row.id !== excludeId)) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString().slice(-4)}`;
}

export const savePost = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(postInput)
  .handler(async ({ data, context }) => {
    if (!canWrite(context.user)) return { error: "Bạn không có quyền soạn bài viết." };
    const base44 = context.getBase44().asServiceRole;
    const existing = data.id ? await base44.entities.BlogPost.get(data.id) : null;
    if (data.id && !existing) return { error: "Không tìm thấy bài viết." };
    if (existing && !canApprove(context.user) && existing.created_by_id !== context.user.id) {
      return { error: "Bạn chỉ sửa được bài của mình." };
    }

    const html = String(data.content_html ?? existing?.content_html ?? "");
    const words = countWords(plainContent({ content_html: html, content: data.content ?? existing?.content }));
    const requestedStatus = data.status || statusOf(existing) || "Nháp";
    const status = canApprove(context.user)
      ? requestedStatus
      : ["Nháp", "Chờ duyệt"].includes(requestedStatus)
        ? requestedStatus
        : "Chờ duyệt";
    if (status === "Đã lên lịch" && !data.scheduled_at) return { error: "Chọn thời điểm đăng cho bài đã lên lịch." };

    const payload = {
      title: data.title,
      slug: await uniqueSlug(base44, data.slug || data.title, existing?.id),
      summary: data.summary ?? "",
      thumbnail: data.thumbnail ?? "",
      thumbnail_alt: data.thumbnail_alt ?? "",
      category: data.category || "Kinh nghiệm",
      tags: data.tags || [],
      destination: data.destination || "",
      destination_id: data.destination_id || "",
      author: data.author || context.user.full_name || "",
      published_at:
        status === "Đã đăng"
          ? data.published_at || existing?.published_at || new Date().toISOString().slice(0, 10)
          : data.published_at || existing?.published_at || "",
      scheduled_at: data.scheduled_at || "",
      featured: data.featured ?? false,
      comments_enabled: data.comments_enabled ?? true,
      status,
      archived: status === "Lưu trữ",
      meta_title: data.meta_title || "",
      meta_description: data.meta_description || "",
      og_image: data.og_image || "",
      canonical_url: data.canonical_url || "",
      noindex: data.noindex ?? false,
      content_html: html,
      content: plainContent({ content_html: html, content: data.content ?? existing?.content }),
      gallery_images: data.gallery_images || [],
      related_tour_ids: data.related_tour_ids || [],
      related_service_ids: data.related_service_ids || [],
      word_count: words,
      read_minutes: readMinutes(words),
    };

    const versions = Array.isArray(existing?.versions) ? [...existing.versions] : [];
    const changed =
      existing &&
      (existing.title !== payload.title ||
        (existing.content_html || "") !== payload.content_html ||
        (existing.meta_description || "") !== payload.meta_description);
    if (changed) {
      versions.unshift({
        at: new Date().toISOString(),
        author: context.user.full_name || context.user.email || "",
        title: existing.title || "",
        summary: existing.summary || "",
        content_html: existing.content_html || "",
        meta_title: existing.meta_title || "",
        meta_description: existing.meta_description || "",
      });
    }
    if (versions.length) payload.versions = versions.slice(0, 8);

    if (existing) {
      await base44.entities.BlogPost.update(existing.id, payload);
      if (status !== statusOf(existing)) {
        await logAction(base44, context.user, "Đổi trạng thái bài viết", `${payload.title}: ${statusOf(existing)} → ${status}`, existing.id);
      } else {
        await logAction(base44, context.user, "Cập nhật bài viết", payload.title, existing.id);
      }
      return { id: existing.id, slug: payload.slug, status };
    }

    const created = await base44.entities.BlogPost.create({ ...payload, created_by_id: context.user.id });
    await logAction(base44, context.user, "Tạo bài viết", payload.title, created.id);
    return { id: created.id, slug: payload.slug, status };
  });

export const setPostStatus = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string(), status: z.enum(["Nháp", "Chờ duyệt", "Đã lên lịch", "Đã đăng", "Lưu trữ"]), scheduled_at: z.string().max(30).optional() }))
  .handler(async ({ data, context }) => {
    if (!canWrite(context.user)) return { error: "Bạn không có quyền đổi trạng thái bài viết." };
    const base44 = context.getBase44().asServiceRole;
    const post = await base44.entities.BlogPost.get(data.id);
    if (!post) return { error: "Không tìm thấy bài viết." };
    const approveStatuses = ["Đã đăng", "Đã lên lịch"];
    if (approveStatuses.includes(data.status) && !canApprove(context.user)) {
      return { error: "Chỉ Quản lý hoặc Admin được duyệt đăng bài." };
    }
    if (!canApprove(context.user) && post.created_by_id !== context.user.id) {
      return { error: "Bạn chỉ sửa được bài của mình." };
    }
    const patch = { status: data.status, archived: data.status === "Lưu trữ" };
    if (data.status === "Đã lên lịch") patch.scheduled_at = data.scheduled_at || "";
    if (data.status === "Đã đăng" && !post.published_at) patch.published_at = new Date().toISOString().slice(0, 10);
    await base44.entities.BlogPost.update(data.id, patch);
    await logAction(base44, context.user, "Đổi trạng thái bài viết", `${post.title}: ${statusOf(post)} → ${data.status}`, data.id);
    return { ok: true };
  });

export const bulkPostStatus = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ ids: z.array(z.string()).min(1).max(100), status: z.enum(["Nháp", "Chờ duyệt", "Đã lên lịch", "Đã đăng", "Lưu trữ"]) }))
  .handler(async ({ data, context }) => {
    if (!canWrite(context.user)) return { error: "Bạn không có quyền đổi trạng thái bài viết." };
    const base44 = context.getBase44().asServiceRole;
    const rows = asArray(await base44.entities.BlogPost.list({ limit: 400 })).filter((post) => data.ids.includes(post.id));
    const allowed = rows.filter(
      (post) => canApprove(context.user) || post.created_by_id === context.user.id,
    );
    if (!canApprove(context.user) && ["Đã đăng", "Đã lên lịch"].includes(data.status)) {
      return { error: "Chỉ Quản lý hoặc Admin được duyệt đăng bài." };
    }
    const patch = { status: data.status, archived: data.status === "Lưu trữ" };
    await base44.entities.BlogPost.bulkUpdate(allowed.map((post) => ({ id: post.id, ...patch })));
    await logAction(base44, context.user, "Đổi trạng thái hàng loạt", `${allowed.length} bài → ${data.status}`, "");
    return { updated: allowed.length };
  });

export const archivePost = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string(), archived: z.boolean() }))
  .handler(async ({ data, context }) => {
    if (!canWrite(context.user)) return { error: "Bạn không có quyền lưu trữ bài viết." };
    const base44 = context.getBase44().asServiceRole;
    const post = await base44.entities.BlogPost.get(data.id);
    if (!post) return { error: "Không tìm thấy bài viết." };
    if (!canApprove(context.user) && post.created_by_id !== context.user.id) {
      return { error: "Bạn chỉ sửa được bài của mình." };
    }
    const status = data.archived ? "Lưu trữ" : post.published_at ? "Đã đăng" : "Nháp";
    await base44.entities.BlogPost.update(data.id, { archived: data.archived, status });
    await logAction(base44, context.user, data.archived ? "Lưu trữ bài viết" : "Khôi phục bài viết", post.title, data.id);
    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    if (!canApprove(context.user)) return { error: "Chỉ Quản lý hoặc Admin được xóa hẳn bài viết." };
    const base44 = context.getBase44().asServiceRole;
    const post = await base44.entities.BlogPost.get(data.id);
    if (!post) return { error: "Không tìm thấy bài viết." };
    await base44.entities.BlogPost.delete(data.id);
    await logAction(base44, context.user, "Xóa bài viết", post.title, data.id);
    return { ok: true };
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().optional(), name: z.string().trim().min(2).max(80), description: z.string().max(300).optional(), active: z.boolean().optional() }))
  .handler(async ({ data, context }) => {
    if (!canApprove(context.user)) return { error: "Chỉ Quản lý hoặc Admin được sửa chuyên mục." };
    const base44 = context.getBase44().asServiceRole;
    const rows = asArray(await base44.entities.BlogCategory.list({ limit: 100 }));
    const payload = { name: data.name, slug: slugify(data.name), description: data.description || "", active: data.active !== false };
    if (data.id) {
      await base44.entities.BlogCategory.update(data.id, payload);
      return { id: data.id };
    }
    const created = await base44.entities.BlogCategory.create({ ...payload, sort_order: rows.length });
    return { id: created.id };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    if (!canApprove(context.user)) return { error: "Chỉ Quản lý hoặc Admin được sửa chuyên mục." };
    const base44 = context.getBase44().asServiceRole;
    const category = await base44.entities.BlogCategory.get(data.id);
    const used = asArray(await base44.entities.BlogPost.filter({ category: category.name }, { limit: 1 }));
    if (used.length) return { error: "Chuyên mục đang có bài viết, hãy ẩn thay vì xóa." };
    await base44.entities.BlogCategory.delete(data.id);
    return { ok: true };
  });

export const suggestPostSeo = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ title: z.string().max(200).optional(), content_html: z.string().max(60000).optional(), destination: z.string().max(120).optional() }))
  .handler(async ({ data, context }) => {
    if (!canWrite(context.user)) return { error: "Bạn không có quyền dùng gợi ý AI." };
    const base44 = context.getBase44().asServiceRole;
    const body = plainContent({ content_html: data.content_html }).slice(0, 3000);
    if (body.length < 50) return { error: "Cần ít nhất vài câu nội dung để gợi ý." };
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: [
        "Bạn là biên tập viên SEO du lịch Việt Nam. Dựa trên nội dung bài viết dưới đây, đề xuất:",
        "- 3 tiêu đề hấp dẫn (mỗi tiêu đề 40-65 ký tự, tiếng Việt)",
        "- 1 meta description 120-160 ký tự",
        "- 1 tóm tắt 2 câu",
        "- 5 tag ngắn",
        `Điểm đến: ${data.destination || "chưa rõ"}. Tiêu đề hiện tại: ${data.title || "chưa có"}.`,
        "Nội dung:",
        body,
      ].join("\n"),
      response_json_schema: {
        type: "object",
        properties: {
          titles: { type: "array", items: { type: "string" } },
          meta_description: { type: "string" },
          summary: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["titles", "meta_description", "summary", "tags"],
      },
    });
    return result;
  });

export const suggestFromContent = (form) => seoChecks(form);