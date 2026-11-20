import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthError, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";

// Trang đăng nhập riêng cho quản trị viên (đường dẫn /quan-tri, không gắn ở menu khách).
export function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      const me = await base44.auth.me();
      if (me?.role !== "admin") {
        base44.auth.logout();
        setError("Tài khoản này không có quyền truy cập khu vực quản trị.");
        setBusy(false);
        return;
      }
      // Tải lại ứng dụng với phiên đăng nhập mới.
      window.location.href = "/admin";
    } catch (err) {
      setError(err?.status === 401 || err?.status === 429 || err?.status === 403 ? err.message : "Không thể đăng nhập lúc này.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Quản trị GenTravel"
      subtitle="Khu vực dành riêng cho quản trị viên"
      footer={
        <Link to="/" className="text-muted-foreground transition hover:text-primary">
          ← Về trang chủ
        </Link>
      }
    >
      <AuthError>{error}</AuthError>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-email">Email quản trị</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="admin@gentravel.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 pl-10"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-password">Mật khẩu</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pl-10"
              required
            />
          </div>
        </div>
        <SubmitButton busy={busy} busyLabel="Đang đăng nhập...">
          Đăng nhập quản trị
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        Trang này không dành cho khách truy cập. Nếu bạn cần tư vấn tour, hãy gọi hotline 1900 6789.
      </p>
    </AuthLayout>
  );
}