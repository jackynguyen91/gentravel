import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, LayoutGrid, List, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { can } from "@/lib/roles";
import RequireCapability from "@/components/admin/RequireCapability";
import RequestDrawer from "@/components/admin/service-requests/RequestDrawer";
import RequestBoard from "@/components/admin/service-requests/RequestBoard";
import CreateRequestDialog from "@/components/admin/service-requests/CreateRequestDialog";
import { listServicesAdmin } from "@/lib/admin-services-fns";
import { changeRequestStatus, listServiceRequests } from "@/lib/service-request-fns";
import { REQUEST_STATUS_STYLE, SERVICE_REQUEST_STATUSES } from "@/lib/service-catalog";
import { formatVND } from "@/lib/format";

export const Route = createFileRoute("/_authed/admin/service-requests")({
  component: AdminServiceRequests,
});

function AdminServiceRequests() {
  const { user } = useAuth();
  const loadRequests = useServerFn(listServiceRequests);
  const loadServices = useServerFn(listServicesAdmin);
  const move = useServerFn(changeRequestStatus);

  const [data, setData] = useState({ requests: [], counts: {}, pendingOld: 0, revenue: 0, won: 0, lost: 0 });
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("table");
  const [active, setActive] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = async () => {
    const [requests, serviceList] = await Promise.all([loadRequests(), loadServices()]);
    setData(requests);
    setServices(serviceList.services);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    let rows = data.requests;
    if (tab !== "all") rows = rows.filter((request) => request.status === tab);
    const keyword = search.trim().toLowerCase();
    if (keyword) {
      rows = rows.filter((request) =>
        `${request.request_code} ${request.service_title} ${request.customer_name} ${request.customer_phone}`
          .toLowerCase()
          .includes(keyword),
      );
    }
    return rows;
  }, [data.requests, tab, search]);

  const conversion = data.won + data.lost ? Math.round((data.won / (data.won + data.lost)) * 1000) / 10 : 0;

  if (!can(user, "service_requests")) {
    return <RequireCapability user={user} capability="service_requests"><span /></RequireCapability>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink">Yêu cầu dịch vụ</h1>
          <p className="mt-1 text-[13px] text-slate-500">Vé máy bay, vé tham quan, khách sạn, visa và đưa đón — theo dõi từ lúc nhận đến khi thu tiền.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Tạo yêu cầu
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Doanh thu dịch vụ</p>
          <p className="mt-1 font-heading text-xl font-extrabold text-ink tnum">{formatVND(data.revenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Tỷ lệ chốt yêu cầu</p>
          <p className="mt-1 font-heading text-xl font-extrabold text-ink tnum">{conversion}%</p>
        </div>
        <div className={`rounded-xl border p-3 shadow-card ${data.pendingOld ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-white"}`}>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {data.pendingOld ? <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> : null} Chờ xử lý quá 30 phút
          </p>
          <p className="mt-1 font-heading text-xl font-extrabold text-ink tnum">{data.pendingOld}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
              tab === "all" ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            Tất cả {data.counts.all || 0}
          </button>
          {SERVICE_REQUEST_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setTab(status)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                tab === status ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {status} {data.counts[status] || 0}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã, khách, dịch vụ…"
              aria-label="Tìm yêu cầu"
              className="h-9 w-[210px] rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[12.5px] outline-none focus:border-brand"
            />
          </div>
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setView("table")}
              aria-label="Xem dạng bảng"
              className={`grid h-9 w-9 place-items-center ${view === "table" ? "bg-brand text-white" : "bg-white text-slate-500"}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              aria-label="Xem dạng kanban"
              className={`grid h-9 w-9 place-items-center ${view === "kanban" ? "bg-brand text-white" : "bg-white text-slate-500"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 grid h-40 place-items-center rounded-2xl border border-slate-100 bg-white text-sm text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 grid h-40 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
          Chưa có yêu cầu nào.
        </div>
      ) : view === "kanban" ? (
        <RequestBoard
          requests={filtered}
          onOpen={setActive}
          onMove={async (id, status) => {
            try {
              await move({ data: { id, status, actor: user?.full_name || user?.email || "" } });
              await refresh();
            } catch {
              toast.error("Chưa đổi được trạng thái");
            }
          }}
        />
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-card">
          <table className="w-full min-w-[880px] text-left text-[12.5px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.06em] text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Mã / Dịch vụ</th>
                <th className="px-3 py-2.5">Khách</th>
                <th className="px-3 py-2.5">Ngày dùng</th>
                <th className="px-3 py-2.5 text-right">Giá báo</th>
                <th className="px-3 py-2.5">Phụ trách</th>
                <th className="px-3 py-2.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((request) => (
                <tr key={request.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/70" onClick={() => setActive(request)}>
                  <td className="px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-slate-400">{request.request_code}</p>
                    <p className="font-semibold text-ink">{request.service_title}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink">{request.customer_name}</p>
                    <p className="text-[11.5px] text-slate-400">{request.customer_phone}</p>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{request.use_date || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-ink tnum">{formatVND(request.quoted_price)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{request.sale_owner || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${REQUEST_STATUS_STYLE[request.status] || "bg-slate-100 text-slate-600"}`}>
                      {request.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RequestDrawer request={active} open={Boolean(active)} onOpenChange={(open) => !open && setActive(null)} onChanged={refresh} />
      <CreateRequestDialog open={createOpen} onOpenChange={setCreateOpen} services={services} onCreated={refresh} />
    </div>
  );
}