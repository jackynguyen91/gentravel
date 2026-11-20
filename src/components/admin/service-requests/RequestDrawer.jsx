import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/lib/AuthContext";
import { loadSettings } from "@/lib/settings";
import { REQUEST_STATUS_STYLE, SERVICE_REQUEST_STATUSES } from "@/lib/service-catalog";
import { formatVND } from "@/lib/format";
import { buildQuotePdf } from "@/lib/service-quote-pdf";
import {
  addRequestNote,
  changeRequestStatus,
  recordServicePayment,
  requestPayments,
  sendServiceQuoteEmail,
  updateServiceRequest,
} from "@/lib/service-request-fns";

const input = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:border-brand";
const labelText = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
const card = "rounded-xl border border-slate-100 bg-white p-3";

export default function RequestDrawer({ request, open, onOpenChange, onChanged }) {
  const { user } = useAuth();
  const actor = user?.full_name || user?.email || "Quản trị viên";
  const changeStatus = useServerFn(changeRequestStatus);
  const saveRequest = useServerFn(updateServiceRequest);
  const loadPayments = useServerFn(requestPayments);
  const addNote = useServerFn(addRequestNote);
  const pay = useServerFn(recordServicePayment);
  const sendQuote = useServerFn(sendServiceQuoteEmail);

  const [quoted, setQuoted] = useState(0);
  const [cost, setCost] = useState(0);
  const [notes, setNotes] = useState("");
  const [payments, setPayments] = useState([]);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("Chuyển khoản");
  const [email, setEmail] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!request) return;
    setQuoted(Number(request.quoted_price) || 0);
    setCost(Number(request.cost_price) || 0);
    setEmail(request.customer_email || "");
    setAmount(Number(request.quoted_price) || 0);
    setNotes("");
    setCancelReason("");
    loadPayments({ data: { code: request.request_code } }).then((rows) => setPayments(rows || []));
  }, [request?.id]);

  if (!request) return null;
  const paid = payments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const setStatus = async (status) => {
    if (status === "Hủy" && !cancelReason.trim()) return toast.error("Vui lòng nhập lý do hủy");
    setBusy(status);
    try {
      await changeStatus({ data: { id: request.id, status, reason: cancelReason, actor } });
      toast.success(`Đã chuyển sang ${status}`);
      onChanged?.();
    } finally {
      setBusy("");
    }
  };

  const saveQuote = async () => {
    setBusy("quote");
    try {
      await saveRequest({ data: { id: request.id, quoted_price: Number(quoted) || 0, cost_price: Number(cost) || 0 } });
      toast.success("Đã lưu báo giá");
      onChanged?.();
    } finally {
      setBusy("");
    }
  };

  const sendPdf = async () => {
    if (!email.trim()) return toast.error("Cần email khách để gửi báo giá");
    setBusy("send");
    try {
      const { settings } = await loadSettings();
      const payload = { ...request, quoted_price: Number(quoted) || 0 };
      const base64 = await buildQuotePdf(payload, settings);
      await sendQuote({
        data: {
          id: request.id,
          to: email.trim(),
          subject: `Báo giá ${request.request_code} – ${request.service_title}`,
          html: `<p>Kính gửi ${request.customer_name},</p><p>${settings.company_name || "GenTravel"} gửi bạn báo giá dịch vụ <strong>${request.service_title}</strong> (mã ${request.request_code}) với tổng tiền <strong>${formatVND(quoted)}</strong>.</p><p>Báo giá chi tiết đính kèm trong file PDF.</p><p>Trân trọng,<br/>${settings.company_name || "GenTravel"}</p>`,
          filename: `bao-gia-${request.request_code}.pdf`,
          pdf_base64: base64,
          actor,
        },
      });
      toast.success("Đã gửi báo giá kèm PDF cho khách");
      onChanged?.();
    } catch {
      toast.error("Chưa gửi được báo giá. Vui lòng thử lại.");
    } finally {
      setBusy("");
    }
  };

  const recordPayment = async () => {
    if (!Number(amount)) return toast.error("Nhập số tiền đã thu");
    setBusy("pay");
    try {
      await pay({ data: { id: request.id, amount: Number(amount), method, actor } });
      setPayments(await loadPayments({ data: { code: request.request_code } }));
      toast.success("Đã ghi nhận thanh toán vào sổ");
      onChanged?.();
    } finally {
      setBusy("");
    }
  };

  const submitNote = async () => {
    if (!notes.trim()) return;
    await addNote({ data: { id: request.id, text: notes.trim(), author: actor } });
    setNotes("");
    toast.success("Đã thêm ghi chú");
    onChanged?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-0 bg-admin-bg p-0 sm:max-w-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{request.request_code}</p>
            <h2 className="font-heading text-lg font-extrabold text-ink">{request.service_title}</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              {request.customer_name} · {request.customer_phone}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${REQUEST_STATUS_STYLE[request.status] || "bg-slate-100 text-slate-600"}`}>
            {request.status}
          </span>
        </div>

        <div className="space-y-3 p-4">
          <section className={card}>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Thông tin yêu cầu</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-[12.5px]">
              <div><dt className="text-slate-500">Ngày dùng</dt><dd className="font-semibold text-ink">{request.use_date || "—"}{request.end_date ? ` → ${request.end_date}` : ""}</dd></div>
              <div><dt className="text-slate-500">Số khách</dt><dd className="font-semibold text-ink">{request.adults_count || 0} NL · {request.children_count || 0} TE</dd></div>
              <div><dt className="text-slate-500">Nguồn</dt><dd className="font-semibold text-ink">{request.channel || "—"}</dd></div>
              {request.source_post_title ? (
                <div className="col-span-2"><dt className="text-slate-500">Bài viết nguồn</dt><dd className="font-semibold text-ink">{request.source_post_title}</dd></div>
              ) : null}
              <div><dt className="text-slate-500">Phụ trách</dt><dd className="font-semibold text-ink">{request.sale_owner || "—"}</dd></div>
            </dl>
            {request.content ? <p className="mt-2 rounded-lg bg-slate-50 p-2 text-[12.5px] text-slate-600">{request.content}</p> : null}
          </section>

          <section className={card}>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Báo giá & lợi nhuận</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className={labelText}>Giá báo (VND)</label>
                <input type="number" className={input} value={quoted} onChange={(e) => setQuoted(e.target.value)} />
              </div>
              <div>
                <label className={labelText}>Giá nhập (VND)</label>
                <input type="number" className={input} value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
            </div>
            <p className="mt-1.5 text-[12px] text-slate-500">
              Lợi nhuận tạm tính: <strong className="text-ink">{formatVND((Number(quoted) || 0) - (Number(cost) || 0))}</strong> · Đã thu {formatVND(paid)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" onClick={saveQuote} disabled={busy === "quote"} className="h-9 rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-white disabled:opacity-60">
                Lưu báo giá
              </button>
              <button type="button" onClick={sendPdf} disabled={busy === "send"} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12.5px] font-semibold text-slate-600 disabled:opacity-60">
                {busy === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Gửi báo giá PDF
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input className={`${input} pl-8`} placeholder="Email khách" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email khách nhận báo giá" />
              </div>
            </div>
          </section>

          <section className={card}>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Trạng thái</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SERVICE_REQUEST_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatus(status)}
                  disabled={busy === status}
                  className={`h-8 rounded-lg px-2.5 text-[12px] font-semibold disabled:opacity-60 ${
                    request.status === status ? "bg-brand text-white" : "border border-slate-200 text-slate-600"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            <input className={`${input} mt-2`} placeholder="Lý do hủy (bắt buộc khi chọn Hủy)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </section>

          <section className={card}>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Thanh toán (sổ Thanh toán)</h3>
            <div className="mt-2 space-y-1.5">
              {payments.length === 0 ? <p className="text-[12.5px] text-slate-400">Chưa có giao dịch.</p> : null}
              {payments.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px]">
                  <span className="text-slate-600">{row.method} · {String(row.paid_at || row.created_date || "").slice(0, 10)}</span>
                  <span className="font-semibold text-ink tnum">{formatVND(row.amount)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-[1fr,120px] gap-1.5">
              <input type="number" className={input} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Số tiền thu" />
              <select className={input} value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Phương thức">
                {["Chuyển khoản", "Tiền mặt", "VietQR", "MoMo", "Thẻ tín dụng"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={recordPayment} disabled={busy === "pay"} className="mt-1.5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-white disabled:opacity-60">
              {busy === "pay" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Ghi nhận thanh toán
            </button>
          </section>

          <section className={card}>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Lịch sử xử lý</h3>
            <ol className="mt-2 space-y-2 border-l border-slate-200 pl-3">
              {(request.activities || []).map((activity, index) => (
                <li key={index} className="relative text-[12px] text-slate-600">
                  <span className="absolute -left-[17px] top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
                  <p className="font-medium text-ink">{activity.text}</p>
                  <p className="text-[11px] text-slate-400">
                    {String(activity.at || "").slice(0, 16).replace("T", " ")} · {activity.actor || ""}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-3 space-y-1.5">
              <textarea
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] outline-none focus:border-brand"
                placeholder="Thêm ghi chú nội bộ"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <button type="button" onClick={submitNote} className="h-8 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600">
                Lưu ghi chú
              </button>
              {(request.notes || []).map((note, index) => (
                <p key={index} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-600">
                  {note.text} <span className="text-[11px] text-slate-400">· {note.author}</span>
                </p>
              ))}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}