import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { Loader2, Plus, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { can } from "@/lib/roles";
import RequireCapability from "@/components/admin/RequireCapability";
import ServiceRow from "@/components/admin/services/ServiceRow";
import ServicesToolbar from "@/components/admin/services/ServicesToolbar";
import ServiceFormDialog from "@/components/admin/services/ServiceFormDialog";
import { SERVICE_STATUSES, servicePrice } from "@/lib/service-catalog";
import {
  archiveService,
  duplicateService,
  hardDeleteService,
  listServicesAdmin,
  normalizeServices,
  reorderServices,
  setServicePinned,
  setServiceStatus,
  syncDestinations,
} from "@/lib/admin-services-fns";

export const Route = createFileRoute("/_authed/admin/services")({
  component: AdminServices,
});

const PAGE_SIZE = 8;

function AdminServices() {
  const { user } = useAuth();
  const load = useServerFn(listServicesAdmin);
  const toggleStatus = useServerFn(setServiceStatus);
  const togglePin = useServerFn(setServicePinned);
  const archive = useServerFn(archiveService);
  const remove = useServerFn(hardDeleteService);
  const duplicate = useServerFn(duplicateService);
  const reorder = useServerFn(reorderServices);
  const normalize = useServerFn(normalizeServices);
  const syncDest = useServerFn(syncDestinations);

  const [data, setData] = useState({ services: [], types: [], destinations: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeType, setActiveType] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [destination, setDestination] = useState("all");
  const [sort, setSort] = useState("manual");
  const [page, setPage] = useState(1);

  const refresh = async () => {
    const result = await load();
    setData({ services: result.services, types: result.types, destinations: result.destinations });
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeType, search, status, destination, sort]);

  const live = useMemo(() => data.services.filter((service) => !service.archived), [data.services]);
  const archived = useMemo(() => data.services.filter((service) => service.archived), [data.services]);

  const typeCounts = useMemo(() => {
    const counts = { all: live.length };
    live.forEach((service) => {
      counts[service.type] = (counts[service.type] || 0) + 1;
    });
    return counts;
  }, [live]);

  const filtered = useMemo(() => {
    let rows = status === "archived" ? archived : live;
    if (status !== "all" && status !== "archived") rows = rows.filter((service) => service.status === status);
    if (activeType !== "all") rows = rows.filter((service) => service.type === activeType);
    if (destination !== "all") rows = rows.filter((service) => service.destination === destination);
    const keyword = search.trim().toLowerCase();
    if (keyword) {
      rows = rows.filter((service) =>
        `${service.title} ${service.summary || ""} ${service.supplier_name || ""} ${service.destination || ""}`
          .toLowerCase()
          .includes(keyword),
      );
    }
    const sorted = [...rows];
    if (sort === "manual") sorted.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.sort_order || 0) - (b.sort_order || 0));
    if (sort === "newest") sorted.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    if (sort === "price_asc") sorted.sort((a, b) => servicePrice(a) - servicePrice(b));
    if (sort === "price_desc") sorted.sort((a, b) => servicePrice(b) - servicePrice(a));
    if (sort === "requests") sorted.sort((a, b) => (b.request_count || 0) - (a.request_count || 0));
    return sorted;
  }, [live, archived, status, activeType, destination, search, sort]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onDragEnd = async (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const rows = [...paged];
    const [moved] = rows.splice(result.source.index, 1);
    rows.splice(result.destination.index, 0, moved);
    setData((prev) => ({
      ...prev,
      services: prev.services.map((service) => {
        const index = rows.findIndex((row) => row.id === service.id);
        return index === -1 ? service : { ...service, sort_order: (page - 1) * PAGE_SIZE + index };
      }),
    }));
    await reorder({ data: { order: rows.map((row, index) => ({ id: row.id, sort_order: (page - 1) * PAGE_SIZE + index })) } });
  };

  const runMaintenance = async (kind) => {
    setBusy(kind);
    try {
      if (kind === "normalize") {
        const result = await normalize();
        toast.success(`Đã chuẩn hóa ${result.updated} dịch vụ · ${result.needsReview} cần rà soát`);
      } else {
        const result = await syncDest();
        toast.success(`Đã đồng bộ ${result.destinations} điểm đến · ${result.toursUpdated} tour · ${result.servicesUpdated} dịch vụ`);
      }
      await refresh();
    } finally {
      setBusy("");
    }
  };

  if (!can(user, "services")) {
    return <RequireCapability user={user} capability="services"><span /></RequireCapability>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink">Dịch vụ khác</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Vé máy bay, vé tham quan, khách sạn, visa và đưa đón — bật/tắt hiển thị, kéo thả để đổi thứ tự.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => runMaintenance("destinations")}
            disabled={busy === "destinations"}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600 disabled:opacity-60"
          >
            {busy === "destinations" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Đồng bộ điểm đến
          </button>
          <button
            type="button"
            onClick={() => runMaintenance("normalize")}
            disabled={busy === "normalize"}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600 disabled:opacity-60"
          >
            {busy === "normalize" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Chuẩn hóa dữ liệu cũ
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Thêm dịch vụ
          </button>
        </div>
      </div>

      <ServicesToolbar
        types={data.types}
        typeCounts={typeCounts}
        activeType={activeType}
        onTypeChange={setActiveType}
        search={search}
        onSearch={setSearch}
        status={status}
        onStatus={setStatus}
        destination={destination}
        onDestination={setDestination}
        destinations={data.destinations}
        sort={sort}
        onSort={setSort}
        statuses={[...SERVICE_STATUSES, "archived"]}
      />

      {archived.length ? (
        <button
          type="button"
          onClick={() => setStatus(status === "archived" ? "all" : "archived")}
          className={`mt-2 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${
            status === "archived" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Đã lưu trữ {archived.length}
        </button>
      ) : null}

      {loading ? (
        <div className="mt-4 grid h-40 place-items-center rounded-2xl border border-slate-100 bg-white text-sm text-slate-400">
          Đang tải dịch vụ…
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 grid h-40 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
          Không có dịch vụ nào khớp bộ lọc.
        </div>
      ) : (
        <>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="services-list" isDropDisabled={sort !== "manual"}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="mt-4 space-y-3">
                  {paged.map((service, index) => (
                    <Draggable key={service.id} draggableId={service.id} index={index} isDragDisabled={sort !== "manual"}>
                      {(dragProvided) => (
                        <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                          <ServiceRow
                            service={service}
                            dragHandleProps={dragProvided.dragHandleProps}
                            onEdit={() => {
                              setEditing(service);
                              setDialogOpen(true);
                            }}
                            onToggle={async () => {
                              const next = service.status === "Đang hiển thị" ? "Ẩn" : "Đang hiển thị";
                              await toggleStatus({ data: { id: service.id, status: next } });
                              await refresh();
                              toast.success(next === "Đang hiển thị" ? "Đã hiển thị trên website" : "Đã ẩn khỏi website");
                            }}
                            onPin={async () => {
                              await togglePin({ data: { id: service.id, pinned: !service.pinned } });
                              await refresh();
                            }}
                            onDuplicate={async () => {
                              await duplicate({ data: { id: service.id } });
                              await refresh();
                              toast.success("Đã nhân bản dịch vụ thành bản nháp");
                            }}
                            onArchive={async () => {
                              await archive({ data: { id: service.id, archived: !service.archived } });
                              await refresh();
                              toast.success(service.archived ? "Đã bỏ lưu trữ" : "Đã lưu trữ dịch vụ");
                            }}
                            onDelete={async () => {
                              const result = await remove({ data: { id: service.id } });
                              if (result?.error) return toast.error(result.error);
                              await refresh();
                              toast.success("Đã xóa dịch vụ");
                            }}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="mt-3 flex items-center justify-between text-[12px] text-slate-500">
            <span>
              {filtered.length} dịch vụ · trang {page}/{pageCount}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold disabled:opacity-50"
              >
                Trước
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(prev + 1, pageCount))}
                disabled={page === pageCount}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 font-semibold disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        </>
      )}

      <ServiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        service={editing}
        onSaved={refresh}
        types={data.types}
        destinations={data.destinations}
        canSeeCost={can(user, "costs")}
      />
    </div>
  );
}