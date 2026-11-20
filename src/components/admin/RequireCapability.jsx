import { ShieldAlert } from "lucide-react";
import { can, roleOf } from "@/lib/roles";

export default function RequireCapability({ user, capability, children }) {
  if (can(user, capability)) return children;

  return (
    <div className="grid min-h-[320px] place-items-center">
      <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <h2 className="mt-3 font-heading text-lg font-extrabold text-ink">Không có quyền truy cập</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
          Vai trò <strong>{roleOf(user)}</strong> không được xem khu vực này. Liên hệ Admin nếu cần cấp quyền.
        </p>
      </div>
    </div>
  );
}