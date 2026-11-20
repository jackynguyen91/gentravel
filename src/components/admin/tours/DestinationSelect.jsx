import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus } from "lucide-react";
import { field } from "@/components/admin/tours/form-parts";
import { createTourDestination, listTourDestinations } from "@/lib/tour-form-fns";

// Ô chọn điểm đến từ danh sách quản lý được, có thêm mới ngay trong ô chọn.
export default function DestinationSelect({ value, onChange, placeholder = "Chọn điểm đến" }) {
  const fetchOptions = useServerFn(listTourDestinations);
  const createDestination = useServerFn(createTourDestination);
  const [options, setOptions] = useState([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchOptions()
      .then((rows) => setOptions(rows || []))
      .catch(() => setOptions([]));
  }, []);

  const addNew = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const created = await createDestination({ data: { name: trimmed } });
      setOptions((prev) => (prev.some((row) => row.name === created.name) ? prev : [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "vi"))));
      onChange(created.name);
      setName("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  const known = options.some((row) => row.name === value);

  return (
    <div className="space-y-1.5">
      <select className={field} value={value || ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {value && !known ? <option value={value}>{value} (chưa có trong danh sách)</option> : null}
        {options.map((row) => (
          <option key={row.id || row.name} value={row.name}>
            {row.name}
          </option>
        ))}
      </select>
      {adding ? (
        <div className="flex gap-1.5">
          <input className={field} value={name} placeholder="Tên điểm đến mới" onChange={(event) => setName(event.target.value)} />
          <button
            type="button"
            onClick={addNew}
            disabled={busy}
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-brand px-3 text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Lưu
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="h-10 shrink-0 rounded-lg border border-slate-200 px-2 text-[12px] font-semibold text-slate-500"
          >
            Hủy
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand">
          <Plus className="h-3.5 w-3.5" /> Thêm điểm đến mới
        </button>
      )}
    </div>
  );
}