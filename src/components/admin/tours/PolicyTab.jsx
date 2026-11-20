import { Plus, Trash2 } from "lucide-react";
import { Section, area, field, ghostButton } from "@/components/admin/tours/form-parts";
import { DOCUMENT_PRESETS } from "@/lib/tour-catalog";
import LineListEditor from "@/components/admin/tours/LineListEditor";
import NotesGroupsEditor from "@/components/admin/tours/NotesGroupsEditor";

export default function PolicyTab({ form, set }) {
  const documents = form.required_documents || [];

  const setPolicy = (index, key, value) =>
    set("cancellation_policy", form.cancellation_policy.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  const setDocuments = (value) => set("required_documents", value.split("\n"));

  return (
    <div className="space-y-3">
      <Section title="Bao gồm / không bao gồm" hint="Từng dòng một mục, kéo thả để đổi thứ tự hiển thị trên trang khách.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Dịch vụ bao gồm</p>
            <LineListEditor
              items={form.included_services || []}
              onChange={(items) => set("included_services", items)}
              placeholder="VD: Khách sạn 4* tại trung tâm"
              addLabel="Thêm mục bao gồm"
              emptyHint="Chưa có mục bao gồm."
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-600">Không bao gồm</p>
            <LineListEditor
              items={form.excluded_services || []}
              onChange={(items) => set("excluded_services", items)}
              placeholder="VD: Chi phí cá nhân, đồ uống"
              addLabel="Thêm mục không bao gồm"
              emptyHint="Chưa có mục không bao gồm."
            />
          </div>
        </div>
      </Section>

      <NotesGroupsEditor form={form} set={set} />

      <Section title="Giấy tờ cần thiết" hint="Hộ chiếu còn hạn 6 tháng, visa, giấy khai sinh cho trẻ em… mỗi dòng một loại.">
        <textarea
          rows={4}
          className={area}
          placeholder={"Hộ chiếu còn hạn 6 tháng\nVisa nhập cảnh\nGiấy khai sinh cho trẻ em"}
          value={documents.join("\n")}
          onChange={(event) => setDocuments(event.target.value)}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DOCUMENT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDocuments([...documents.filter(Boolean), preset].join("\n"))}
              className="rounded-md bg-cloud px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
            >
              + {preset}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Chính sách hủy" hint="Mốc hủy trước bao nhiêu ngày thì thu bao nhiêu % giá tour (phí hủy, phần còn lại hoàn khách).">
        <div className="space-y-2">
          {form.cancellation_policy.length === 0 && (
            <p className="rounded-lg bg-cloud px-3 py-3 text-[12.5px] text-slate-500">Chưa có mốc hủy nào.</p>
          )}
          {form.cancellation_policy.map((row, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[120px_120px_1fr_36px]">
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} className={field} value={row.days_before} onChange={(e) => setPolicy(index, "days_before", e.target.value)} />
                <span className="text-[11.5px] text-slate-500">ngày</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} max={100} className={field} value={row.fee_percent} onChange={(e) => setPolicy(index, "fee_percent", e.target.value)} />
                <span className="text-[11.5px] text-slate-500">%</span>
              </div>
              <input className={field} placeholder="Ghi chú (VD: hoàn 100% nếu hủy trước 15 ngày)" value={row.note || ""} onChange={(e) => setPolicy(index, "note", e.target.value)} />
              <button
                type="button"
                aria-label="Xóa mốc hủy"
                onClick={() => set("cancellation_policy", form.cancellation_policy.filter((_, i) => i !== index))}
                className="grid h-10 w-9 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => set("cancellation_policy", [...form.cancellation_policy, { days_before: 15, fee_percent: 0, note: "" }])}
          className={`${ghostButton} mt-2`}
        >
          <Plus className="h-3.5 w-3.5" /> Thêm mốc hủy
        </button>
      </Section>
    </div>
  );
}