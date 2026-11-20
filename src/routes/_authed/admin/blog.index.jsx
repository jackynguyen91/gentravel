import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FolderCog, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { can } from "@/lib/roles";
import RequireCapability from "@/components/admin/RequireCapability";
import BlogToolbar from "@/components/admin/blog/BlogToolbar";
import BlogPostCard from "@/components/admin/blog/BlogPostCard";
import CategoryManagerDialog from "@/components/admin/blog/CategoryManagerDialog";
import { archivePost, bulkPostStatus, deletePost, listBlogAdmin } from "@/lib/admin-blog-fns";

export const Route = createFileRoute("/_authed/admin/blog/")({
  component: AdminBlog,
});

const PAGE_SIZE = 8;
const TABS = ["Tất cả", "Đã đăng", "Nháp", "Chờ duyệt", "Đã lên lịch", "Lưu trữ"];

function rangeStart(value) {
  const now = new Date();
  if (value === "7d") return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  if (value === "30d") return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  if (value === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (value === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function AdminBlog() {
  const { user } = useAuth();
  const load = useServerFn(listBlogAdmin);
  const bulk = useServerFn(bulkPostStatus);
  const archive = useServerFn(archivePost);
  const remove = useServerFn(deletePost);

  const [data, setData] = useState({
    posts: [],
    categories: [],
    activeCategories: [],
    options: { authors: [], destinations: [], tours: [], services: [] },
    canApprove: false,
    canWrite: false,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Tất cả");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [author, setAuthor] = useState("all");
  const [destination, setDestination] = useState("all");
  const [sort, setSort] = useState("newest");
  const [range, setRange] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const refresh = async () => {
    const result = await load();
    setData(result);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [status, search, category, author, destination, sort, range]);

  const counts = useMemo(() => {
    const map = { "Tất cả": 0 };
    TABS.slice(1).forEach((tab) => {
      map[tab] = 0;
    });
    data.posts.forEach((post) => {
      const key = post.status || "Đã đăng";
      if (key === "Lưu trữ" || post.archived) {
        map["Lưu trữ"] += 1;
        return;
      }
      map["Tất cả"] += 1;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [data.posts]);

  const filtered = useMemo(() => {
    let rows = [...data.posts];
    if (status === "Lưu trữ") rows = rows.filter((post) => post.status === "Lưu trữ" || post.archived);
    else {
      rows = rows.filter((post) => post.status !== "Lưu trữ" && !post.archived);
      if (status !== "Tất cả") rows = rows.filter((post) => post.status === status);
    }
    if (category !== "all") rows = rows.filter((post) => post.category === category);
    if (author !== "all") rows = rows.filter((post) => post.author === author);
    if (destination !== "all") rows = rows.filter((post) => post.destination === destination);
    const start = rangeStart(range);
    if (start) rows = rows.filter((post) => new Date(post.published_at || post.created_date) >= start);
    const keyword = search.trim().toLowerCase();
    if (keyword) {
      rows = rows.filter((post) =>
        `${post.title} ${post.summary || ""} ${post.destination || ""} ${(post.tags || []).join(" ")}`.toLowerCase().includes(keyword),
      );
    }
    if (sort === "views") rows.sort((a, b) => b.view_count - a.view_count);
    else if (sort === "orders") rows.sort((a, b) => b.order_count - a.order_count);
    else rows.sort((a, b) => new Date(b.published_at || b.created_date) - new Date(a.published_at || a.created_date));
    return rows;
  }, [data.posts, status, category, author, destination, range, search, sort]);

  const pageCount = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const applyBulk = async (next) => {
    if (!next) return;
    setBusy(true);
    const result = await bulk({ data: { ids: selected, status: next } });
    setBusy(false);
    if (result?.error) return toast.error(result.error);
    toast.success(`Đã đổi ${result.updated} bài sang ${next}`);
    setSelected([]);
    await refresh();
  };

  const setArchived = async (post, archived) => {
    const result = await archive({ data: { id: post.id, archived } });
    if (result?.error) return toast.error(result.error);
    toast.success(archived ? "Đã lưu trữ bài viết" : "Đã khôi phục bài viết");
    await refresh();
  };

  const deleteForever = async (post) => {
    const result = await remove({ data: { id: post.id } });
    if (result?.error) return toast.error(result.error);
    toast.success("Đã xóa hẳn bài viết");
    await refresh();
  };

  if (!can(user, "marketing")) {
    return (
      <RequireCapability user={user} capability="marketing">
        <span />
      </RequireCapability>
    );
  }

  const canEditPost = (post) => data.canApprove || post.created_by_id === user?.id;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink">Cẩm nang du lịch</h1>
          <p className="mt-1 text-[13px] text-slate-500">Soạn bài, duyệt đăng và theo dõi hiệu quả nội dung.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCategoryOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600"
          >
            <FolderCog className="h-3.5 w-3.5" /> Chuyên mục
          </button>
          <Link
            to="/admin/blog/$postId"
            params={{ postId: "new" }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Viết bài mới
          </Link>
        </div>
      </div>

      <BlogToolbar
        statusTabs={TABS}
        counts={counts}
        activeStatus={status}
        onStatus={setStatus}
        search={search}
        onSearch={setSearch}
        categories={data.activeCategories}
        category={category}
        onCategory={setCategory}
        authors={data.options.authors}
        author={author}
        onAuthor={setAuthor}
        destinations={data.options.destinations}
        destination={destination}
        onDestination={setDestination}
        sort={sort}
        onSort={setSort}
        range={range}
        onRange={setRange}
        selectedCount={selected.length}
        onClearSelection={() => setSelected([])}
        bulkStatus={applyBulk}
        onBulkStatus={applyBulk}
        canApprove={data.canApprove}
      />

      {loading ? (
        <div className="mt-4 grid h-40 place-items-center rounded-2xl border border-slate-100 bg-white text-sm text-slate-400">
          Đang tải bài viết…
        </div>
      ) : paged.length === 0 ? (
        <div className="mt-4 grid h-40 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
          Không có bài viết nào khớp bộ lọc.
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {paged.map((post) => (
              <div key={post.id}>
                <BlogPostCard
                  post={post}
                  selected={selected.includes(post.id)}
                  onSelect={(checked) =>
                    setSelected((prev) => (checked ? [...prev, post.id] : prev.filter((id) => id !== post.id)))
                  }
                  onArchive={() => setArchived(post, true)}
                  onRestore={() => setArchived(post, false)}
                  canWrite={data.canWrite}
                  canEdit={canEditPost(post)}
                />
                {post.status === "Lưu trữ" && data.canApprove ? (
                  <button
                    type="button"
                    onClick={() => deleteForever(post)}
                    className="ml-8 mt-1 text-[11.5px] font-semibold text-slate-400 hover:text-red-600"
                  >
                    Xóa hẳn bài này
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-500">
            <span>
              {filtered.length} bài · trang {page}/{pageCount}
            </span>
            <div className="flex items-center gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
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

      <CategoryManagerDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        categories={data.categories}
        onChanged={refresh}
        canApprove={data.canApprove}
      />
    </div>
  );
}