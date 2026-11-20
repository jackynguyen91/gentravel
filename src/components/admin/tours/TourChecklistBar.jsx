import { Check, X } from "lucide-react";

// Checklist hoàn thiện tour ở thanh dưới form Sửa tour.
export default function TourChecklistBar({ items, activeTab, onJump }) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      {items.map((item) => {
        const active = item.tab === activeTab;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onJump(item.tab)}
            title={item.ok ? `${item.label}: đã có` : `${item.label}: còn thiếu`}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10.5px] font-semibold transition ${
              item.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-300 bg-amber-50 text-amber-800"
            } ${active ? "ring-1 ring-brand/40" : ""}`}
          >
            {item.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}