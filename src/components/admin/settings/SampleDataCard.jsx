import { Database } from "lucide-react";
import { formatVND } from "@/lib/format";

const input = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] text-ink outline-none focus:border-brand";

export default function SampleDataCard({ form, update }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
      <h3 className="text-[13px] font-bold text-ink">Dữ liệu thật & dữ liệu mẫu</h3>
      <p className="mt-0.5 text-[11.5px] text-slate-500">
        Bật “chỉ dữ liệu thật” để loại các bản ghi tạo trước ngày mốc khỏi báo cáo, thanh toán và dashboard.
      </p>
      <label className="mt-3 inline-flex items-center gap-2 text-[12.5px] font-medium text-slate-600">
        <input
          type="checkbox"
          checked={Boolean(form.hide_sample_data)}
          onChange={(e) => update("hide_sample_data", e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand"
        />
        Chỉ dùng dữ liệu thật
      </label>
      <label className="mt-2 block text-[11.5px] font-medium text-slate-500">
        Ngày mốc dữ liệu mẫu (bản ghi tạo trước ngày này bị coi là dữ liệu mẫu)
        <input
          type="date"
          className={input}
          value={String(form.demo_cutoff || "").slice(0, 10)}
          onChange={(e) => update("demo_cutoff", e.target.value)}
        />
      </label>
      <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-cloud px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
        Bật/tắt chỉ thay đổi số liệu hiển thị, không xóa dữ liệu. Xóa hẳn dữ liệu mẫu thực hiện trong phần dữ liệu của ứng dụng sau khi đã nhập đủ dữ liệu thật.
      </p>
      <p className="mt-2 text-[11px] text-slate-400">Doanh thu tối thiểu để tính hạng khách đang dùng: {formatVND(form.tier_loyal_min)}.</p>
    </section>
  );
}