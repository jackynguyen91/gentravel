import { Plus, Tags, Trash2 } from "lucide-react";
import { DEFAULT_SERVICE_TYPES } from "@/lib/service-catalog";

const input = "h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:border-brand";

export default function ServiceTypesCard({ value, onChange }) {
  const types = Array.isArray(value) && value.length ? value : DEFAULT_SERVICE_TYPES.map((name) => ({ name, active: true }));

  const patch = (index, key, next) => {
    const rows = [...types];
    rows[index] = { ...rows[index], [key]: next };
    onChange(rows);
  };

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand">
          <Tags className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-heading text-[15px] font-bold text-ink">Loại dịch vụ</h2>
          <p className="text-[12px] text-slate-500">Thêm, đổi tên hoặc ẩn loại dịch vụ dùng trong bộ lọc và form.</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {types.map((type, index) => (
          <div key={index} className="flex items-center gap-2">
            <input className={input} value={type.name || ""} onChange={(event) => patch(index, "name", event.target.value)} aria-label={`Tên loại dịch vụ ${index + 1}`} />
            <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-slate-600">
              <input
                type="checkbox"
                checked={type.active !== false}
                onChange={(event) => patch(index, "active", event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand"
              />
              Đang dùng
            </label>
            <button
              type="button"
              onClick={() => onChange(types.filter((_, i) => i !== index))}
              aria-label="Xóa loại dịch vụ"
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...types, { name: "", active: true }])}
        className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-brand"
      >
        <Plus className="h-3.5 w-3.5" /> Thêm loại
      </button>
    </section>
  );
}