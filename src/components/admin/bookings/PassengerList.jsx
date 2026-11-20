import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Eye, IdCard, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deletePassenger,
  listBookingPassengers,
  revealPassengerId,
  savePassenger,
} from "@/lib/admin-passengers-fns";
import { isExpiredBefore } from "@/lib/passengers";
import { formatDateVN } from "@/lib/format";
import PassengerDialog from "./PassengerDialog";

export default function PassengerList({ bookingId, departureDate }) {
  const fetchList = useServerFn(listBookingPassengers);
  const save = useServerFn(savePassenger);
  const remove = useServerFn(deletePassenger);
  const reveal = useServerFn(revealPassengerId);

  const [state, setState] = useState({ loading: true, items: [], canViewFull: false, counts: { total: 0, missing_id: 0 } });
  const [revealed, setRevealed] = useState({});
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState("");

  const refresh = useCallback(async () => {
    if (!bookingId) return;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const result = await fetchList({ data: { booking_id: bookingId } });
      setState({ ...result, loading: false });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [bookingId, fetchList]);

  useEffect(() => {
    setRevealed({});
    refresh();
  }, [refresh]);

  const submit = async (form) => {
    setBusy("save");
    try {
      const result = await save({ data: { ...form, booking_id: bookingId, id: editor?.id } });
      if (result?.error) {
        toast.error(result.error);
        return false;
      }
      setEditor(null);
      await refresh();
      toast.success("Đã lưu hành khách");
      return true;
    } catch (error) {
      toast.error("Không lưu được hành khách.");
      return false;
    } finally {
      setBusy("");
    }
  };

  const removePassenger = async (passenger) => {
    if (!window.confirm(`Xoá hành khách ${passenger.full_name}?`)) return;
    setBusy(passenger.id);
    try {
      const result = await remove({ data: { id: passenger.id } });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      await refresh();
      toast.success("Đã xoá hành khách");
    } catch (error) {
      toast.error("Không xoá được hành khách.");
    } finally {
      setBusy("");
    }
  };

  const revealId = async (passenger) => {
    setBusy(passenger.id);
    try {
      const result = await reveal({ data: { id: passenger.id } });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setRevealed((prev) => ({ ...prev, [passenger.id]: result.id_number || "Chưa nhập số" }));
    } catch (error) {
      toast.error("Không xem được số giấy tờ.");
    } finally {
      setBusy("");
    }
  };

  const items = state.items || [];

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          Hành khách ({items.length})
        </h3>
        <button
          type="button"
          onClick={() => setEditor({})}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[11.5px] font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
        >
          <Plus className="h-3.5 w-3.5" /> Thêm
        </button>
      </div>

      {state.loading ? (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải danh sách…
        </p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-[12px] text-slate-400">Chưa nhập danh sách hành khách.</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-slate-100">
            {items.map((passenger, index) => {
              const expired = isExpiredBefore(passenger.id_expiry_date, departureDate);
              return (
                <li key={passenger.id} className="py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium text-ink">
                        {index + 1}. {passenger.full_name}
                        {passenger.gender ? <span className="text-slate-400"> · {passenger.gender}</span> : null}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {passenger.passenger_type}
                        {passenger.birth_date ? ` · ${formatDateVN(passenger.birth_date)}` : ""}
                        {passenger.nationality ? ` · ${passenger.nationality}` : ""}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-[11.5px] text-slate-600 tnum">
                        <IdCard className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium">{passenger.id_type || "CCCD"}:</span>
                        <span className="font-semibold text-ink">
                          {revealed[passenger.id] || passenger.id_number_masked || "chưa nhập"}
                        </span>
                        {passenger.has_id && state.canViewFull && !revealed[passenger.id] && (
                          <button
                            type="button"
                            onClick={() => revealId(passenger)}
                            disabled={busy === passenger.id}
                            className="inline-flex items-center gap-0.5 rounded px-1 text-[10.5px] font-semibold text-brand hover:underline disabled:opacity-50"
                          >
                            {busy === passenger.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />} Hiện số
                          </button>
                        )}
                      </p>
                      {passenger.id_expiry_date && (
                        <p className={`mt-0.5 text-[10.5px] ${expired ? "font-semibold text-rose-600" : "text-slate-400"}`}>
                          {expired ? "Hết hạn trước khởi hành: " : "Hết hạn: "}
                          {formatDateVN(passenger.id_expiry_date)}
                        </p>
                      )}
                      {passenger.note && <p className="mt-0.5 text-[11px] text-slate-500">{passenger.note}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditor(passenger)}
                        aria-label={`Sửa ${passenger.full_name}`}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-brand hover:text-brand"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePassenger(passenger)}
                        disabled={busy === passenger.id}
                        aria-label={`Xoá ${passenger.full_name}`}
                        className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                      >
                        {busy === passenger.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {state.counts.missing_id > 0 && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" /> {state.counts.missing_id} hành khách chưa có số giấy tờ
            </p>
          )}
          {!state.canViewFull && (
            <p className="mt-1.5 text-[10.5px] text-slate-400">
              Số giấy tờ luôn được che với tài khoản không phải quản trị viên.
            </p>
          )}
        </>
      )}

      <PassengerDialog
        open={Boolean(editor)}
        onOpenChange={(open) => !open && setEditor(null)}
        passenger={editor}
        onSubmit={submit}
        busy={busy === "save"}
      />
    </section>
  );
}