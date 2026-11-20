import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { loadSettings, saveSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import RequireCapability from "@/components/admin/RequireCapability";
import CompanyCard from "@/components/admin/settings/CompanyCard";
import PaymentPolicyCard from "@/components/admin/settings/PaymentPolicyCard";
import EmailTemplateCard from "@/components/admin/settings/EmailTemplateCard";
import SampleDataCard from "@/components/admin/settings/SampleDataCard";
import ServiceTypesCard from "@/components/admin/settings/ServiceTypesCard";

export const Route = createFileRoute("/_authed/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { record: row, settings } = await loadSettings();
      setRecord(row);
      setForm(settings);
    })();
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const id = await saveSettings(record, form);
      if (!record) setRecord({ ...form, id });
      await logActivity({
        module: "Hệ thống",
        action: "Cập nhật cài đặt",
        detail: "Thông tin công ty, chính sách thanh toán, mẫu email và dữ liệu mẫu",
        entity_id: id,
        actor: user?.full_name || user?.email || "",
      });
      toast.success("Đã lưu cài đặt");
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="space-y-3">
        <div className="h-9 w-64 animate-pulse rounded bg-white shadow-card" />
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl bg-white shadow-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <RequireCapability user={user} capability="settings">
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink">Cài đặt</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Thông tin công ty, hạn thanh toán, hạng khách hàng, chính sách hủy và dữ liệu mẫu.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu cài đặt
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <CompanyCard form={form} update={update} />
        <PaymentPolicyCard form={form} update={update} />
        <EmailTemplateCard form={form} update={update} />
        <SampleDataCard form={form} update={update} />
        <ServiceTypesCard value={form.service_types} onChange={(next) => update("service_types", next)} />
      </div>

      <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11.5px] text-slate-500 shadow-card">
        <Building2 className="h-3.5 w-3.5 text-brand" /> Thông tin công ty hiển thị trên phiếu thu, file PDF và email gửi khách.
      </p>
    </div>
    </RequireCapability>
  );
}