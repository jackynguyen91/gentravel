import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { can } from "@/lib/roles";
import RequireCapability from "@/components/admin/RequireCapability";
import { Image } from "@/components/ui/image";
import { base44 } from "@/api/base44Client";
import { bulkAltMedia, deleteMediaAsset, listMediaAssets, saveMediaAsset } from "@/lib/admin-media-fns";

export const Route = createFileRoute("/_authed/admin/media")({
  head: () => ({ meta: [{ title: "Thư viện ảnh – GenTravel" }] }),
  component: AdminMedia,
});

function AdminMedia() {
  const { user } = useAuth();
  const load = useServerFn(listMediaAssets);
  const save = useServerFn(saveMediaAsset);
  const bulkAlt = useServerFn(bulkAltMedia);
  const remove = useServerFn(deleteMediaAsset);

  const [assets, setAssets] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [altText, setAltText] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const result = await load();
    setAssets(result.assets || []);
    setCanManage(Boolean(result.canManage));
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return assets;
    return assets.filter((asset) => `${asset.name || ""} ${asset.alt || ""} ${asset.url}`.toLowerCase().includes(keyword));
  }, [assets, search]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      await save({ data: { url: file_url, name: file.name, alt: "", size_bytes: file.size } });
      toast.success("Đã tải ảnh lên thư viện");
      await refresh();
    } catch {
      toast.error("Chưa tải được ảnh. Vui lòng thử lại.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const applyBulkAlt = async () => {
    if (!selected.length || !altText.trim()) return;
    setBusy(true);
    const result = await bulkAlt({ data: { ids: selected, alt: altText.trim() } });
    setBusy(false);
    if (result?.error) return toast.error(result.error);
    toast.success(`Đã cập nhật alt cho ${result.updated} ảnh`);
    setSelected([]);
    setAltText("");
    await refresh();
  };

  const editAlt = async (asset) => {
    const value = window.prompt("Mô tả ảnh (alt):", asset.alt || "");
    if (value === null) return;
    await save({ data: { id: asset.id, url: asset.url, name: asset.name, alt: value } });
    await refresh();
  };

  if (!can(user, "marketing")) {
    return (
      <RequireCapability user={user} capability="marketing">
        <span />
      </RequireCapability>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-ink">Thư viện ảnh</h1>
          <p className="mt-1 text-[13px] text-slate-500">Tải ảnh một lần, dùng lại cho bài viết và tour. Ảnh lưu công khai theo đường dẫn.</p>
        </div>
        {canManage ? (
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Tải ảnh lên
            <input type="file" accept="image/*" onChange={upload} className="hidden" disabled={uploading} />
          </label>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-white p-2">
        <div className="flex h-9 min-w-[220px] flex-1 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc mô tả ảnh…" className="h-full w-full bg-transparent text-[12.5px] outline-none" />
        </div>
        {selected.length ? (
          <>
            <input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Alt chung cho ảnh đã chọn" className="h-9 rounded-lg border border-slate-200 px-2.5 text-[12.5px] outline-none focus:border-brand" />
            <button type="button" onClick={applyBulkAlt} disabled={busy || !altText.trim()} className="h-9 rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-white disabled:opacity-60">
              Gán alt cho {selected.length} ảnh
            </button>
            <button type="button" onClick={() => setSelected([])} className="text-[12px] font-semibold text-slate-500 underline">
              Bỏ chọn
            </button>
          </>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 grid h-40 place-items-center rounded-2xl border border-slate-100 bg-white text-sm text-slate-400">Đang tải thư viện…</div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 grid h-40 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">Chưa có ảnh nào.</div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((asset) => (
            <article key={asset.id} className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-card">
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <Image src={asset.url} alt={asset.alt || asset.name || ""} className="h-full w-full" fittingType="fill" />
              </div>
              <div className="p-2.5">
                <div className="flex items-start gap-1.5">
                  <input
                    type="checkbox"
                    checked={selected.includes(asset.id)}
                    onChange={(event) => setSelected((prev) => (event.target.checked ? [...prev, asset.id] : prev.filter((id) => id !== asset.id)))}
                    aria-label={`Chọn ảnh ${asset.name || ""}`}
                    className="mt-0.5 h-3 w-3 rounded border-slate-300 text-brand"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-ink">{asset.name || "Ảnh"}</p>
                    <p className="line-clamp-2 text-[11px] text-slate-500">{asset.alt || "Chưa có mô tả alt"}</p>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(asset.url);
                      toast.success("Đã sao chép đường dẫn ảnh");
                    }}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 hover:text-brand"
                  >
                    <Copy className="h-3 w-3" /> Lấy URL
                  </button>
                  {canManage ? (
                    <button type="button" onClick={() => editAlt(asset)} className="h-7 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 hover:text-brand">
                      Sửa alt
                    </button>
                  ) : null}
                  {canManage ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const result = await remove({ data: { id: asset.id } });
                        if (result?.error) return toast.error(result.error);
                        toast.success("Đã xóa ảnh khỏi thư viện");
                        await refresh();
                      }}
                      aria-label="Xóa ảnh"
                      className="ml-auto grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}