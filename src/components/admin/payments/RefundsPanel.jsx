import { Check, X } from "lucide-react";
import { formatDateVN, formatVND } from "@/lib/format";

export default function RefundsPanel({ rows, loading, canApprove, onDecide, busyId }) {
  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-11 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="grid h-40 place-items-center rounded-2xl border border-slate-100 bg-white text-sm text-slate-500 shadow-card">
        Không có yêu cầu hoàn tiền nào đang chờ duyệt.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
      <div className="border-b border-slate-100 px-4 py-2.5 text-[11.5px] text-slate-500">
        {rows.length} yêu cầu hoàn tiền · tổng {formatVND(rows.reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0))}
        {!canApprove ? " · chỉ Quản lý và Admin được duyệt" : ""}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead className="bg-cloud text-[11px] uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Đơn / Khách</th>
              <th className="px-3 py-3 text-right font-semibold">Số tiền hoàn</th>
              <th className="px-3 py-3 font-semibold">Căn cứ</th>
              <th className="px-3 py-3 font-semibold">Ngày tạo</th>
              <th className="px-3 py-3 text-right font-semibold">Quyết định</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-cloud/60">
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{row.customer_name || "Khách hàng"}</p>
                  <p className="text-[11.5px] text-slate-500">{row.booking_code || "—"}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-rose-700 tnum">{formatVND(Math.abs(Number(row.amount) || 0))}</td>
                <td className="px-3 py-3 text-[11.5px] text-slate-600">{row.note || "Theo chính sách hủy của tour"}</td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateVN(row.created_date)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  {canApprove ? (
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => onDecide(row, true)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand px-2.5 text-[11.5px] font-semibold text-white disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" /> Duyệt
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => onDecide(row, false)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11.5px] font-semibold text-slate-600 hover:text-red-600 disabled:opacity-60"
                      >
                        <X className="h-3.5 w-3.5" /> Từ chối
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11.5px] text-slate-400">Chờ Quản lý duyệt</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}