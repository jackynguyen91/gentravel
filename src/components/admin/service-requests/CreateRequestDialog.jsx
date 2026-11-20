import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { createServiceRequest } from "@/lib/service-request-fns";
import { getPosts } from "@/lib/server-fns";
import { formatVND } from "@/lib/format";

const input = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus:border-brand";
const labelText = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";

export default function CreateRequestDialog({ open, onOpenChange, services, onCreated, defaultServiceId }) {
  const create = useServerFn(createServiceRequest);
  const loadPosts = useServerFn(getPosts);
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState({
    service_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    use_date: "",
    end_date: "",
    adults_count: 1,
    children_count: 0,
    content: "",
    channel: "Hotline",
    source_post: "",
    sale_owner: "",
    quoted_price: 0,
    cost_price: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm((prev) => ({ ...prev, service_id: defaultServiceId || "", customer_name: "", customer_phone: "", customer_email: "", content: "", source_post: "", quoted_price: 0, cost_price: 0 }));
    loadPosts().then((rows) => setPosts(rows || [])).catch(() => setPosts([]));
  }, [open, defaultServiceId, loadPosts]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const selected = services.find((item) => item.id === form.service_id);

  const submit = async () => {
    if (!selected) return setError("Vui lòng chọn dịch vụ.");
    if (form.customer_name.trim().length < 2) return setError("Vui lòng nhập tên khách.");
    if (form.customer_phone.trim().length < 8) return setError("Số điện thoại chưa hợp lệ.");
    setSaving(true);
    setError("");
    try {
      const result = await create({
        data: {
          service_id: selected.id,
          service_title: selected.title,
          service_type: selected.type,
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          customer_email: form.customer_email.trim(),
          use_date: form.use_date,
          end_date: form.end_date,
          adults_count: Number(form.adults_count) || 0,
          children_count: Number(form.children_count) || 0,
          content: form.content,
          channel: form.channel,
          source_post: form.channel === "Bài viết" ? form.source_post : "",
          sale_owner: form.sale_owner,
          quoted_price: Number(form.quoted_price) || 0,
          cost_price: Number(form.cost_price) || 0,
        },
      });
      toast.success(`Đã tạo yêu cầu ${result.request_code}`);
      onCreated?.(result.id);
      onOpenChange(false);
    } catch {
      setError("Chưa tạo được yêu cầu. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogTitle className="font-heading text-lg font-extrabold text-ink">Yêu cầu dịch vụ mới</DialogTitle>
        <DialogDescription className="text-[12.5px] text-slate-500">
          Ghi nhận yêu cầu của khách, hệ thống tự cấp mã YC-YYMM-0001.
        </DialogDescription>

        <div className="mt-3 space-y-2.5">
          <div>
            <label className={labelText}>Dịch vụ</label>
            <select className={input} value={form.service_id} onChange={(e) => set("service_id", e.target.value)}>
              <option value="">Chọn dịch vụ…</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.title} · {service.type}
                </option>
              ))}
            </select>
            {selected ? (
              <p className="mt-1 text-[11.5px] text-slate-400">Giá niêm yết {formatVND(selected.price || selected.price_from || 0)}</p>
            ) : null}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label className={labelText}>Khách hàng</label>
              <input className={input} value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
            </div>
            <div>
              <label className={labelText}>Điện thoại</label>
              <input className={input} value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelText}>Email</label>
              <input className={input} value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} />
            </div>
            <div>
              <label className={labelText}>Ngày dùng / bay / nhận phòng</label>
              <input type="date" className={input} value={form.use_date} onChange={(e) => set("use_date", e.target.value)} />
            </div>
            <div>
              <label className={labelText}>Ngày kết thúc</label>
              <input type="date" className={input} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
            </div>
            <div>
              <label className={labelText}>Người lớn</label>
              <input type="number" min={0} className={input} value={form.adults_count} onChange={(e) => set("adults_count", e.target.value)} />
            </div>
            <div>
              <label className={labelText}>Trẻ em</label>
              <input type="number" min={0} className={input} value={form.children_count} onChange={(e) => set("children_count", e.target.value)} />
            </div>
            <div>
              <label className={labelText}>Nguồn</label>
              <select className={input} value={form.channel} onChange={(e) => set("channel", e.target.value)}>
                {["Website", "Facebook", "Zalo", "Hotline", "Đại lý", "Walk-in", "Trực tiếp", "Bài viết"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            {form.channel === "Bài viết" ? (
              <div>
                <label className={labelText}>Bài viết nguồn</label>
                <select className={input} value={form.source_post} onChange={(e) => set("source_post", e.target.value)}>
                  <option value="">Chọn bài viết…</option>
                  {posts.map((post) => (
                    <option key={post.id} value={post.slug}>
                      {post.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label className={labelText}>Nhân viên phụ trách</label>
              <input className={input} value={form.sale_owner} onChange={(e) => set("sale_owner", e.target.value)} />
            </div>
            <div>
              <label className={labelText}>Giá báo (VND)</label>
              <input type="number" min={0} className={input} value={form.quoted_price} onChange={(e) => set("quoted_price", e.target.value)} />
            </div>
            <div>
              <label className={labelText}>Giá nhập (VND)</label>
              <input type="number" min={0} className={input} value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelText}>Nội dung yêu cầu</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] outline-none focus:border-brand"
                value={form.content}
                onChange={(e) => set("content", e.target.value)}
              />
            </div>
          </div>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => onOpenChange(false)} className="h-9 rounded-lg border border-slate-200 px-3.5 text-[13px] font-semibold text-slate-600">
              Hủy
            </button>
            <button type="button" onClick={submit} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-4 text-[13px] font-semibold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Tạo yêu cầu
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}