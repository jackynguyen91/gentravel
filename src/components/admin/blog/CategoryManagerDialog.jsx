import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { saveCategory } from "@/lib/admin-blog-fns";

export default function CategoryManagerDialog({ open, onOpenChange, categories, onChanged, canApprove }) {
  const save = useServerFn(saveCategory);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const add = async () => {
    const value = name.trim();
    if (value.length < 2) return;
    setBusy(true);
    const result = await save({ data: { name: value } });
    setBusy(false);
    if (result?.error) return toast.error(result.error);
    setName("");
    onChanged();
  };

  const toggle = async (category) => {
    setBusy(true);
    const result = await save({ data: { id: category.id, name: category.name, active: category.active === false } });
    setBusy(false);
    if (result?.error) return toast.error(result.error);
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft">
        <h2 className="font-heading text-lg font-extrabold text-ink">Chuyên mục bài viết</h2>
        <p className="mt-1 text-[12.5px] text-slate-500">Bật/tắt hoặc thêm chuyên mục mới. Bài cũ giữ nguyên chuyên mục đã gán.</p>

        <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-[13px] text-ink">{category.name}</span>
              <button
                type="button"
                disabled={busy || !canApprove}
                onClick={() => toggle(category)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  category.active === false ? "bg-slate-100 text-slate-500" : "bg-brand-50 text-brand"
                } disabled:opacity-50`}
              >
                {category.active === false ? "Đang ẩn" : "Đang dùng"}
              </button>
            </div>
          ))}
        </div>

        {canApprove ? (
          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Tên chuyên mục mới"
              className="h-9 flex-1 rounded-lg border border-slate-200 px-2.5 text-[12.5px] outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={add}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => onOpenChange(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[12.5px] font-semibold text-slate-600">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}