import { formatVND } from "@/lib/format";

export default function ReportTable({ columns, rows, empty = "Chưa có dữ liệu trong kỳ này.", minWidth = 760 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]" style={{ minWidth }}>
        <thead className="bg-cloud text-[11px] uppercase tracking-[0.08em] text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-3 font-semibold ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-[12.5px] text-slate-500">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id || row.key || index} className="hover:bg-cloud/60">
                {columns.map((col) => {
                  const value = col.render ? col.render(row) : row[col.key];
                  const display = col.format === "money" ? formatVND(value) : col.format === "percent" ? `${(Number(value) || 0).toFixed(1)}%` : value;
                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-3 ${col.align === "right" ? "text-right tnum" : col.align === "center" ? "text-center tnum" : ""} ${
                        col.tone ? col.tone(row) : "text-slate-600"
                      }`}
                    >
                      {display ?? "—"}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}