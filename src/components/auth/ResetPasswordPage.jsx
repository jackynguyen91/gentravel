import { Link } from "@tanstack/react-router";
import { AlertTriangle, Lock } from "lucide-react";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { AuthError, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The /reset-password page; the reset email links here with ?token=.
export function ResetPasswordPage() {
  // Read raw: the router's search parser would turn an all-digit token into a number.
  const token = new URLSearchParams(window.location.search).get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }
    setBusy(true);
    try {
      await base44.auth.resetPassword({ resetToken: token, newPassword: password });
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Không đặt lại được mật khẩu.");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Liên kết không hợp lệ"
        subtitle="Liên kết đặt lại mật khẩu bị thiếu hoặc không đúng"
        footer={
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Yêu cầu liên kết mới
          </Link>
        }
      >
        <p className="text-center text-sm text-foreground">Liên kết có vẻ chưa đầy đủ. Vui lòng yêu cầu gửi lại email đặt lại mật khẩu.</p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout icon={Lock} title="Mật khẩu mới" subtitle="Nhập mật khẩu mới của bạn (tối thiểu 8 ký tự)">
      <AuthError>{error}</AuthError>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-password">Mật khẩu mới</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="reset-password" type="password" autoComplete="new-password" autoFocus placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">Nhập lại mật khẩu</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="reset-confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12 pl-10" required />
          </div>
        </div>
        <SubmitButton busy={busy} busyLabel="Đang lưu...">
          Đặt lại mật khẩu
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
