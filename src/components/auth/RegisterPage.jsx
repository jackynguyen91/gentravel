import { Lock, Mail, User, UserPlus } from "lucide-react";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthError, AuthLink, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeReturnTo } from "@/lib/authReturnTo";

// Trang /register: đăng ký xong là đăng nhập luôn (không cần mã OTP).
// Tài khoản đầu tiên của hệ thống (hoặc email nằm trong ADMIN_EMAILS) tự động là quản trị viên.
export function RegisterPage() {
  const returnTo = safeReturnTo();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function register(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }
    setBusy(true);
    try {
      await base44.auth.register({ email, password, full_name: fullName });
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Đăng ký không thành công.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout icon={UserPlus} title="Tạo tài khoản" subtitle="Đăng ký để bắt đầu">
      <AuthError>{error}</AuthError>
      <form onSubmit={register} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="register-name">Họ và tên</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="register-name" autoComplete="name" autoFocus placeholder="Nguyễn Văn A" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12 pl-10" disabled={busy} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="register-email" type="email" autoComplete="email" placeholder="ban@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" disabled={busy} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">Mật khẩu (tối thiểu 8 ký tự)</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="register-password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10" disabled={busy} minLength={8} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-confirm">Nhập lại mật khẩu</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="register-confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12 pl-10" disabled={busy} required />
          </div>
        </div>
        <SubmitButton busy={busy} busyLabel="Đang tạo tài khoản...">
          Tạo tài khoản
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <AuthLink to="/login" returnTo={returnTo}>
          Đăng nhập
        </AuthLink>
      </p>
    </AuthLayout>
  );
}
