import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  Copy,
  Download,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Ticket,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  addBookingNote,
  duplicateBooking,
  getBookingDetail,
  recordBookingPayment,
  sendBookingEmails,
  updateBookingStatus,
} from "@/lib/admin-bookings-fns";
import { BOOKING_STATUSES, FLOW_STEPS, PAYMENT_LABEL, PAYMENT_STYLE, STATUS_DOT, statusStyle } from "@/lib/booking-status";
import { formatDateVN, formatVND } from "@/lib/format";
import { downloadInvoicePdf } from "@/lib/admin/invoice-pdf";
import BookingNotesTimeline from "./BookingNotesTimeline";
import BookingReceiveDialog from "./BookingReceiveDialog";
import PassengerList from "./PassengerList";

const TABS = [
  { key: "overview", label: "Tổng quan" },
  { key: "passengers", label: "Hành khách" },
  { key: "payments", label: "Thanh toán" },
  { key: "history", label: "Lịch sử" },
];

const REASON_REQUIRED = ["Đã hủy", "Hoàn tiền"];

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-2">
    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
    <div className="min-w-0">
      <p className="text-[10.5px] uppercase tracking-[0.06em] text-slate-400">{label}</p>
      <p className="truncate text-[12.5px] font-medium text-ink">{value || "—"}</p>
    </div>
  </div>
);

const MoneyRow = ({ label, value, strong }) => (
  <div className="flex items-center justify-between gap-2 py-1">
    <span className="text-[12px] text-slate-500">{label}</span>
    <span className={`tnum ${strong ? "text-[13px] font-bold text-ink" : "text-[12.5px] font-semibold text-ink"}`}>{value}</span>
  </div>
);

export default function BookingDrawer({ bookingId, onClose, onChanged }) {
  const loadDetail = useServerFn(getBookingDetail);
  const changeStatus = useServerFn(updateBookingStatus);
  const sendEmail = useServerFn(sendBookingEmails);
  const addNote = useServerFn(addBookingNote);
  const addPayment = useServerFn(recordBookingPayment);
  const duplicate = useServerFn(duplicateBooking);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("overview");
  const [reasonFor, setReasonFor] = useState(null);
  const [reason, setReason] = useState("");
  const [receiveOpen, setReceiveOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const result = await loadDetail({ data: { id: bookingId } });
      setDetail(result);
    } finally {
      setLoading(false);
    }
  }, [bookingId, loadDetail]);

  useEffect(() => {
    if (!bookingId) {
      setDetail(null);
      return;
    }
    setTab("overview");
    refresh();
  }, [bookingId, refresh]);

  const booking = detail?.booking;

  const changeTo = async (status, why) => {
    if (!booking || status === booking.status) return;
    setBusy("status");
    try {
      const result = await changeStatus({ data: { id: booking.id, status, reason: why } });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setReasonFor(null);
      setReason("");
      await refresh();
      onChanged?.();
      toast.success(`Đã chuyển sang “${status}”`);
    } catch (error) {
      toast.error("Không cập nhật được trạng thái.");
    } finally {
      setBusy("");
    }
  };

  const pickStatus = (status) => {
    if (REASON_REQUIRED.includes(status)) {
      setReason("");
      setReasonFor(status);
      return;
    }
    changeTo(status);
  };

  const submitNote = async (text) => {
    setBusy("note");
    try {
      const result = await addNote({ data: { id: booking.id, text } });
      if (result?.error) {
        toast.error(result.error);
        return false;
      }
      await refresh();
      onChanged?.();
      return true;
    } catch (error) {
      toast.error("Không lưu được ghi chú.");
      return false;
    } finally {
      setBusy("");
    }
  };

  const submitPayment = async (payload) => {
    setBusy("payment");
    try {
      const result = await addPayment({ data: { id: booking.id, ...payload } });
      if (result?.error) {
        toast.error(result.error);
        return false;
      }
      await refresh();
      onChanged?.();
      toast.success(`Đã ghi nhận ${formatVND(payload.amount)}`);
      return true;
    } catch (error) {
      toast.error("Không ghi nhận được thanh toán.");
      return false;
    } finally {
      setBusy("");
    }
  };

  const emailCustomer = async () => {
    setBusy("email");
    try {
      const result = await sendEmail({ data: { ids: [booking.id] } });
      if (result?.sent) {
        toast.success(`Đã gửi email xác nhận tới ${booking.customer_email}`);
        await refresh();
        onChanged?.();
      } else {
        toast.error("Đơn chưa có email khách hàng hoặc gửi thất bại.");
      }
    } catch (error) {
      toast.error("Không gửi được email.");
    } finally {
      setBusy("");
    }
  };

  const printPdf = async () => {
    setBusy("pdf");
    try {
      await downloadInvoicePdf(booking, detail?.payments || []);
    } catch (error) {
      toast.error("Không tạo được file PDF.");
    } finally {
      setBusy("");
    }
  };

  const cloneBooking = async () => {
    setBusy("duplicate");
    try {
      const result = await duplicate({ data: { id: booking.id } });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Đã nhân bản thành đơn ${result.booking_code}`);
      onChanged?.();
    } catch (error) {
      toast.error("Không nhân bản được đơn.");
    } finally {
      setBusy("");
    }
  };

  const openReceipt = async (uri) => {
    try {
      const result = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
      window.open(result.signed_url, "_blank", "noopener");
    } catch (error) {
      toast.error("Không mở được chứng từ.");
    }
  };

  const flowIndex = booking ? FLOW_STEPS.indexOf(booking.status) : -1;
  const total = Number(booking?.total_price) || 0;
  const collected = detail?.collected ?? 0;
  const remaining = detail?.remaining ?? Math.max(total - collected, 0);

  return (
    <Sheet open={Boolean(bookingId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[640px]">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 py-3">
          <SheetHeader className="space-y-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="font-heading text-lg font-extrabold text-ink">
                {booking ? `Đơn ${booking.booking_code}` : "Chi tiết đơn"}
              </SheetTitle>
              {booking && (
                <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusStyle(booking.status)}`}>{booking.status}</span>
              )}
              {booking && (
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${PAYMENT_STYLE[booking.payment_status] || PAYMENT_STYLE.Unpaid}`}
                >
                  {PAYMENT_LABEL[booking.payment_status] || PAYMENT_LABEL.Unpaid}
                </span>
              )}
            </div>
            <SheetDescription className="text-[12px] text-slate-500">
              {booking ? `${booking.customer_name} · ${booking.customer_phone}` : "Đang tải thông tin đơn…"}
            </SheetDescription>
          </SheetHeader>

          {booking && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <select
                value={booking.status}
                onChange={(event) => pickStatus(event.target.value)}
                disabled={busy === "status"}
                aria-label="Cập nhật trạng thái đơn"
                className={`h-8 rounded-lg border px-2 text-[11.5px] font-semibold outline-none ${statusStyle(booking.status)}`}
              >
                {BOOKING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setReceiveOpen(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand px-2.5 text-[11.5px] font-semibold text-white transition hover:bg-brand-700"
              >
                <Wallet className="h-3.5 w-3.5" /> Xác nhận đã nhận tiền
              </button>
              <button
                type="button"
                onClick={emailCustomer}
                disabled={busy === "email"}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11.5px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand disabled:opacity-60"
              >
                {busy === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Email
              </button>
              <button
                type="button"
                onClick={printPdf}
                disabled={busy === "pdf"}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11.5px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand disabled:opacity-60"
              >
                {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} In PDF
              </button>
              <button
                type="button"
                onClick={cloneBooking}
                disabled={busy === "duplicate"}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11.5px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand disabled:opacity-60"
              >
                {busy === "duplicate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Nhân bản
              </button>
            </div>
          )}

          {booking && flowIndex >= 0 && (
            <ol className="mt-2.5 flex flex-wrap items-center gap-1">
              {FLOW_STEPS.map((step, index) => (
                <li key={step} className="flex items-center gap-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                      index <= flowIndex ? "bg-brand-50 text-brand" : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${index <= flowIndex ? STATUS_DOT[step] : "bg-slate-300"}`} />
                    {step}
                  </span>
                  {index < FLOW_STEPS.length - 1 && <span className="h-px w-2 bg-slate-200" />}
                </li>
              ))}
            </ol>
          )}

          {booking && (
            <div className="mt-2.5 flex gap-1 overflow-x-auto rounded-lg bg-cloud p-1 no-scrollbar">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`h-7 shrink-0 rounded-md px-2.5 text-[11.5px] font-semibold transition ${
                    tab === item.key ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!booking && (
          <div className="grid flex-1 place-items-center py-16 text-[13px] text-slate-400">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Không tìm thấy đơn."}
          </div>
        )}

        {booking && tab === "overview" && (
          <div className="space-y-3 p-4">
            <section className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Khách đặt</h3>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                <InfoRow icon={UserRound} label="Họ tên" value={booking.customer_name} />
                <InfoRow icon={Phone} label="Điện thoại" value={booking.customer_phone} />
                <InfoRow icon={Mail} label="Email" value={booking.customer_email} />
                <InfoRow icon={MapPin} label="Nguồn đặt" value={booking.channel || "Website"} />
                {booking.source_post_title ? (
                  <InfoRow icon={FileText} label="Bài viết nguồn" value={booking.source_post_title} />
                ) : null}
                <InfoRow icon={Users} label="Nhân viên phụ trách" value={booking.sale_owner} />
                <InfoRow icon={CalendarDays} label="Ngày tạo" value={formatDateVN(booking.booking_date || booking.created_date, true)} />
              </div>
              {(booking.customer_note || booking.special_requests) && (
                <p className="mt-2 rounded-lg bg-cloud px-2.5 py-1.5 text-[12px] text-slate-600">
                  <span className="font-semibold text-slate-500">Ghi chú của khách: </span>
                  {booking.customer_note || booking.special_requests}
                </p>
              )}
              {booking.voucher_code && (
                <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11.5px] font-semibold text-amber-700">
                  <Ticket className="h-3.5 w-3.5" /> Voucher {booking.voucher_code}
                </p>
              )}
              {booking.cancellation_reason && (
                <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[12px] text-rose-700">
                  <span className="font-semibold">Lý do hủy: </span>
                  {booking.cancellation_reason}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Tour &amp; khởi hành</h3>
              <p className="mt-1.5 text-[13px] font-semibold text-ink">{booking.tour_title}</p>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                <InfoRow icon={CalendarDays} label="Ngày khởi hành" value={formatDateVN(booking.departure_date)} />
                <InfoRow
                  icon={Users}
                  label="Số khách"
                  value={`${Number(booking.adults_count) || 0} NL · ${Number(booking.children_count) || 0} TE · ${Number(booking.infants_count) || 0} EB`}
                />
              </div>

              <div className="mt-3 rounded-lg bg-cloud px-2.5 py-1.5">
                <MoneyRow
                  label={`Đơn giá người lớn${Number(booking.discount_percent) > 0 ? ` (giảm ${booking.discount_percent}%)` : ""}`}
                  value={formatVND(booking.unit_price_adult || 0)}
                />
                <MoneyRow label="Đơn giá trẻ em" value={formatVND(booking.unit_price_child || 0)} />
                {Number(booking.unit_price_infant) > 0 && <MoneyRow label="Đơn giá em bé" value={formatVND(booking.unit_price_infant)} />}
                {(booking.addons || []).map((addon, index) => (
                  <MoneyRow
                    key={index}
                    label={`${addon.service_title} × ${addon.quantity}`}
                    value={formatVND(addon.amount)}
                  />
                ))}
                <MoneyRow label="Tổng tiền đơn" value={formatVND(total)} strong />
                <MoneyRow label="Đã thu" value={formatVND(collected)} />
                <MoneyRow label="Còn thiếu" value={formatVND(remaining)} />
              </div>
              <p className="mt-1.5 text-[10.5px] text-slate-400">
                Đơn giá được lưu cố định tại thời điểm đặt, thay đổi bảng giá tour không làm đổi đơn này.
              </p>
            </section>
          </div>
        )}

        {booking && tab === "passengers" && (
          <div className="space-y-3 p-4">
            {detail?.tour?.scope === "international" && (
              <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11.5px] font-medium text-amber-800">
                Tour quốc tế: cần bổ sung số hộ chiếu và ngày hết hạn cho từng hành khách.
              </p>
            )}
            <PassengerList bookingId={booking.id} departureDate={booking.departure_date} />
          </div>
        )}

        {booking && tab === "payments" && (
          <div className="space-y-3 p-4">
            <section className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Giao dịch</h3>
                <button
                  type="button"
                  onClick={() => setReceiveOpen(true)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand px-2.5 text-[11.5px] font-semibold text-white"
                >
                  <Wallet className="h-3.5 w-3.5" /> Nhận tiền
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-cloud px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-[0.06em] text-slate-400">Giá trị</p>
                  <p className="text-[12.5px] font-semibold text-ink tnum">{formatVND(total)}</p>
                </div>
                <div className="rounded-lg bg-emerald-50/70 px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-[0.06em] text-emerald-700/70">Đã thu</p>
                  <p className="text-[12.5px] font-semibold text-emerald-700 tnum">{formatVND(collected)}</p>
                </div>
                <div className="rounded-lg bg-amber-50/70 px-2 py-1.5">
                  <p className="text-[10px] uppercase tracking-[0.06em] text-amber-700/70">Còn thiếu</p>
                  <p className="text-[12.5px] font-semibold text-amber-700 tnum">{formatVND(remaining)}</p>
                </div>
              </div>

              <div className="mt-2 space-y-1.5">
                {(detail?.payments || []).length === 0 && <p className="text-[12px] text-slate-400">Chưa ghi nhận giao dịch nào.</p>}
                {(detail?.payments || []).map((payment) => (
                  <div key={payment.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-ink">
                        {payment.method}
                        {payment.kind ? <span className="text-slate-400"> · {payment.kind}</span> : null}
                      </p>
                      <p className="text-[10.5px] text-slate-400">
                        {formatDateVN(payment.paid_at, true)}
                        {payment.confirmed_by ? ` · ${payment.confirmed_by}` : ""}
                        {payment.note ? ` · ${payment.note}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-[12px] font-semibold text-emerald-700 tnum">+{formatVND(payment.amount)}</span>
                      {payment.receipt_file_uri && (
                        <button
                          type="button"
                          onClick={() => openReceipt(payment.receipt_file_uri)}
                          className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-brand hover:underline"
                        >
                          <Paperclip className="h-3 w-3" /> Chứng từ
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {booking && tab === "history" && (
          <div className="space-y-3 p-4">
            <section className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Thay đổi trạng thái</h3>
              <ol className="mt-2 space-y-2">
                {[...(booking.activities || [])].reverse().map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    <div className="min-w-0">
                      <p className="text-[12px] text-ink">{entry.text}</p>
                      <p className="text-[10.5px] text-slate-400">
                        {formatDateVN(entry.at, true)}
                        {entry.actor ? ` · ${entry.actor}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
                {(booking.activities || []).length === 0 && <p className="text-[12px] text-slate-400">Chưa có lịch sử.</p>}
              </ol>
            </section>

            <BookingNotesTimeline booking={booking} onAddNote={submitNote} busy={busy} />
          </div>
        )}

        {detail?.customer && (
          <p className="px-4 pb-4 text-[11.5px] text-slate-400">
            Hồ sơ khách: {detail.customer.full_name} · hạng {detail.customer.tier}
            {detail.customer.tags?.length ? ` · ${detail.customer.tags.join(", ")}` : ""}
          </p>
        )}
      </SheetContent>

      <BookingReceiveDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        remaining={remaining}
        busy={busy}
        onSubmit={submitPayment}
      />

      <Dialog open={Boolean(reasonFor)} onOpenChange={(open) => !open && setReasonFor(null)}>
        <DialogContent className="max-w-md sm:rounded-xl">
          <DialogTitle className="text-[15px] font-semibold text-ink">Lý do {reasonFor?.toLowerCase()}</DialogTitle>
          <DialogDescription className="text-[12px] text-slate-500">
            Bắt buộc ghi lý do để lưu vào lịch sử đơn và đối soát sau này.
          </DialogDescription>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Ví dụ: khách bận việc gia đình, không đi được"
            className="mt-3 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] outline-none focus:border-brand"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setReasonFor(null)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[12.5px] font-medium text-slate-600">
              Đóng
            </button>
            <button
              type="button"
              onClick={() => changeTo(reasonFor, reason)}
              disabled={!reason.trim() || busy === "status"}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {busy === "status" && <Loader2 className="h-4 w-4 animate-spin" />} Xác nhận {reasonFor?.toLowerCase()}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}