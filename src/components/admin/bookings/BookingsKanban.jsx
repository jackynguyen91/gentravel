import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { KANBAN_STATUSES, STATUS_DOT, statusStyle } from "@/lib/booking-status";
import { formatDateVN, formatVND } from "@/lib/format";

const REASON_REQUIRED = ["Đã hủy", "Hoàn tiền"];

export default function BookingsKanban({ items, onOpen, loading, onMove, busy }) {
  const [dragId, setDragId] = useState(null);
  const [overStatus, setOverStatus] = useState(null);
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState("");

  const drop = (status) => {
    setOverStatus(null);
    const booking = items.find((item) => item.id === dragId);
    setDragId(null);
    if (!booking || booking.status === status) return;
    if (REASON_REQUIRED.includes(status)) {
      setReason("");
      setPending({ booking, status });
      return;
    }
    onMove(booking.id, status);
  };

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {KANBAN_STATUSES.map((status) => {
          const list = items.filter((booking) => booking.status === status);
          const value = list.reduce((sum, booking) => sum + (Number(booking.total) || 0), 0);
          return (
            <section
              key={status}
              onDragOver={(event) => {
                event.preventDefault();
                setOverStatus(status);
              }}
              onDragLeave={() => setOverStatus((prev) => (prev === status ? null : prev))}
              onDrop={(event) => {
                event.preventDefault();
                drop(status);
              }}
              className={`flex w-[272px] shrink-0 flex-col rounded-2xl border bg-slate-50/70 transition ${
                overStatus === status ? "border-brand/60 bg-brand-50/40" : "border-slate-100"
              }`}
            >
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status] || "bg-slate-400"}`} />
                  <span className="truncate text-[12px] font-semibold text-ink">{status}</span>
                  <span className="rounded-md bg-white px-1.5 py-0.5 text-[10.5px] font-bold text-slate-500">{list.length}</span>
                </div>
              </header>
              <div className="max-h-[calc(100vh-330px)] space-y-2 overflow-y-auto p-2">
                {loading && <div className="h-16 animate-pulse rounded-xl bg-white" />}
                {!loading && list.length === 0 && <p className="px-1 py-4 text-center text-[11.5px] text-slate-400">Chưa có đơn</p>}
                {!loading &&
                  list.map((booking) => (
                    <div
                      key={booking.id}
                      draggable
                      onDragStart={() => setDragId(booking.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStatus(null);
                      }}
                      className={`rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm transition ${
                        dragId === booking.id ? "opacity-50" : "hover:border-brand/40 hover:shadow-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => onOpen(booking.id)} className="font-heading text-[12.5px] font-bold text-brand hover:underline">
                          {booking.code}
                        </button>
                        <span className="shrink-0 text-[11.5px] font-semibold text-ink tnum">{formatVND(booking.total)}</span>
                      </div>
                      <button type="button" onClick={() => onOpen(booking.id)} className="mt-1 block w-full text-left">
                        <p className="truncate text-[12.5px] font-semibold text-ink">{booking.customer_name}</p>
                        <p className="truncate text-[11px] text-slate-500">{booking.tour_title}</p>
                      </button>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[10.5px] text-slate-400">{formatDateVN(booking.departure_date)}</span>
                        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${statusStyle(booking.status)}`}>
                          {booking.adults} NL{booking.children > 0 ? ` · ${booking.children} TE` : ""}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10.5px] text-slate-400">{booking.channel}</span>
                        <span className="text-[10.5px] text-slate-400 tnum">Đã thu {formatVND(booking.paid)}</span>
                      </div>
                    </div>
                  ))}
                {!loading && list.length > 0 && (
                  <p className="px-1 pt-1 text-[10.5px] text-slate-400 tnum">Tổng giá trị cột: {formatVND(value)}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-md sm:rounded-xl">
          <DialogTitle className="text-[15px] font-semibold text-ink">
            Lý do {pending?.status?.toLowerCase()} đơn {pending?.booking?.code}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-slate-500">Bắt buộc ghi lý do để lưu vào lịch sử đơn.</DialogDescription>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Ví dụ: khách yêu cầu hủy vì lý do sức khỏe"
            className="mt-3 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] outline-none focus:border-brand"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setPending(null)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[12.5px] font-medium text-slate-600">
              Đóng
            </button>
            <button
              type="button"
              disabled={!reason.trim() || busy === "status"}
              onClick={() => {
                onMove(pending.booking.id, pending.status, reason);
                setPending(null);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {busy === "status" && <Loader2 className="h-4 w-4 animate-spin" />} Xác nhận
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}