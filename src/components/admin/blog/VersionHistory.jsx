import { History, RotateCcw } from "lucide-react";

export default function VersionHistory({ versions = [], onRestore }) {
  if (!versions.length) {
    return (
      <section className="rounded-xl border border-slate-100 bg-white p-3.5">
        <h2 className="text-[13px] font-bold text-ink">Lịch sử phiên bản</h2>
        <p className="mt-1 text-[11.5px] text-slate-500">Chưa có bản lưu nào. Mỗi lần lưu thay đổi, hệ thống giữ lại bản trước đó.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3.5">
      <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
        <History className="h-3.5 w-3.5 text-slate-400" /> Lịch sử phiên bản
      </h2>
      <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
        {versions.map((version, index) => (
          <div key={`${version.at}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2 py-1.5">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-slate-700">{version.title || "(không tiêu đề)"}</p>
              <p className="text-[10.5px] text-slate-400">
                {new Date(version.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                {version.author ? ` · ${version.author}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRestore(version)}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-semibold text-slate-600 hover:text-brand"
            >
              <RotateCcw className="h-3 w-3" /> Khôi phục
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}