import { redirect } from "@tanstack/react-router";
import { authQuery } from "@/lib/AuthContext";

/**
 * Cổng vào khu quản trị (dùng ở src/routes/_authed.jsx).
 * Chỉ tài khoản có vai trò admin đi tiếp; khách chưa đăng nhập được đưa về trang
 * đăng nhập quản trị riêng, người dùng thường được đưa về trang chủ mà không
 * hiển thị bất kỳ thông báo nào về cấu trúc hệ thống.
 */
export async function requireAdmin({ context }) {
  const { user, error } = await context.queryClient.ensureQueryData(authQuery);

  if (!user) {
    if (error?.type === "user_not_registered") throw redirect({ to: "/" });
    throw redirect({ to: "/quan-tri" });
  }

  if (user.role !== "admin") throw redirect({ to: "/" });

  return { user };
}