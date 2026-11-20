import { createStart } from "@tanstack/react-start";
import { authMiddleware, base44RequestMiddleware } from "@/lib/auth-middleware";

// Mọi server function và server route nhận `context.getBase44()` hoạt động với quyền của khách đang truy cập.
export const startInstance = createStart(() => ({
  requestMiddleware: [base44RequestMiddleware],
  functionMiddleware: [authMiddleware],
}));
