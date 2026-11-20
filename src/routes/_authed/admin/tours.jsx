import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ToursToolbar from "@/components/admin/tours/ToursToolbar";
import ToursTable from "@/components/admin/tours/ToursTable";
import TourEditorDialog from "@/components/admin/tours/TourEditorDialog";
import { archiveTour, deleteTour, duplicateTour, listAdminTours, toggleTourFeatured } from "@/lib/admin-tours-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatVND } from "@/lib/format";

export const Route = createFileRoute("/_authed/admin/tours")({
  component: AdminTours,
});

const DEFAULT_FILTERS = {
  q: "",
  status: "all",
  category: "all",
  scope: "all",
  destination: "all",
  departure_point: "all",
  tag: "all",
  featured: "all",
  archived: "no",
  sort: "newest",
  page: 1,
  page_size: 20,
};

function AdminTours() {
  const fetchTours = useServerFn(listAdminTours);
  const toggleFeatured = useServerFn(toggleTourFeatured);
  const archive = useServerFn(archiveTour);
  const duplicate = useServerFn(duplicateTour);
  const removeTour = useServerFn(deleteTour);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    statusCounts: {},
    archivedCount: 0,
    totals: { collected: 0, value: 0, orders: 0 },
    facets: { categories: [], destinations: [], departurePoints: [], tags: [] },
  });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [blocked, setBlocked] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTours({ data: filters });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [fetchTours, filters]);

  // Chỉ tải lại khi bộ lọc đổi (tránh gọi lặp nếu tham chiếu hàm tải đổi mỗi lần render).
  useEffect(() => {
    load();
  }, [filters]);

  const onFeatured = async (tour) => {
    setBusyId(tour.id);
    try {
      await toggleFeatured({ data: { id: tour.id, value: !tour.is_featured } });
      await load();
    } catch (error) {
      toast.error("Không đổi được trạng thái nổi bật.");
    } finally {
      setBusyId("");
    }
  };

  const onArchive = async (tour) => {
    setBusyId(tour.id);
    try {
      await archive({ data: { id: tour.id, restore: tour.archived } });
      await load();
      toast.success(tour.archived ? "Đã khôi phục tour" : "Đã lưu trữ tour");
    } catch (error) {
      toast.error("Không cập nhật được tour.");
    } finally {
      setBusyId("");
    }
  };

  const onDuplicate = async (tour) => {
    setBusyId(tour.id);
    try {
      const result = await duplicate({ data: { id: tour.id } });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      await load();
      toast.success(`Đã nhân bản thành “${result.title}” (Nháp)`);
    } catch (error) {
      toast.error("Không nhân bản được tour.");
    } finally {
      setBusyId("");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const result = await removeTour({ data: { id: deleting.id } });
    if (result?.blocked) {
      setDeleting(null);
      setBlocked({ tour: deleting, message: result.error });
      return;
    }
    setDeleting(null);
    await load();
    toast.success("Đã xoá tour");
  };

  const statusLabel = filters.archived === "only" ? "đang lưu trữ" : "đang quản lý";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink">Quản lý tour</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {data.statusCounts.all || 0} tour {statusLabel} · {data.totals.orders} đơn · doanh thu đã thu {formatVND(data.totals.collected)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            aria-label="Tải lại"
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:text-brand"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Thêm tour
          </button>
        </div>
      </div>

      <div className="mt-4">
        <ToursToolbar
          filters={filters}
          onChange={setFilters}
          facets={data.facets}
          statusCounts={data.statusCounts}
          archivedCount={data.archivedCount}
        />
      </div>

      <div className="mt-3">
        <ToursTable
          items={data.items}
          loading={loading}
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          busyId={busyId}
          onPage={(page) => setFilters((prev) => ({ ...prev, page }))}
          onEdit={(tour) => {
            setEditing(tour);
            setDialogOpen(true);
          }}
          onFeatured={onFeatured}
          onArchive={onArchive}
          onDuplicate={onDuplicate}
          onDelete={setDeleting}
        />
      </div>

      <TourEditorDialog open={dialogOpen} onOpenChange={setDialogOpen} tour={editing} onSaved={load} />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogTitle className="font-heading text-lg font-extrabold text-ink">Xoá hẳn tour này?</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] text-slate-600">
            Tour “{deleting?.title}” chưa có đơn đặt nào nên có thể xoá. Nếu chỉ muốn ngừng bán, hãy dùng “Lưu trữ”.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 rounded-xl border border-slate-200 px-4 text-[13px] font-semibold text-slate-600">Giữ lại</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="h-10 rounded-xl bg-red-600 px-4 text-[13px] font-semibold text-white hover:bg-red-700">
              Xoá tour
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(blocked)} onOpenChange={(open) => !open && setBlocked(null)}>
        <AlertDialogContent>
          <AlertDialogTitle className="font-heading text-lg font-extrabold text-ink">Không thể xoá tour đã có đơn</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] text-slate-600">{blocked?.message}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 rounded-xl border border-slate-200 px-4 text-[13px] font-semibold text-slate-600">Đã hiểu</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const tour = blocked?.tour;
                setBlocked(null);
                if (tour) onArchive(tour);
              }}
              className="h-10 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-700"
            >
              Lưu trữ tour này
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}