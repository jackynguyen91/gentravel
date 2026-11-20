import { useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { GripVertical, ImagePlus, Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { Image } from "@/components/ui/image";
import { base44 } from "@/api/base44Client";
import LineListEditor from "@/components/admin/tours/LineListEditor";
import { Section, area, field, ghostButton } from "@/components/admin/tours/form-parts";

const MEALS = ["Sáng", "Trưa", "Tối"];

const emptyDay = (index) => ({ day: index + 1, title: "", description: "", image: "", transport: "", meals: [], hotel: "" });

export default function ItineraryTab({ form, set }) {
  const days = form.route || [];
  const [uploading, setUploading] = useState(-1);
  const [uploadError, setUploadError] = useState("");

  const setDay = (index, key, value) => set("route", days.map((day, i) => (i === index ? { ...day, [key]: value } : day)));
  const addDay = () => set("route", [...days, emptyDay(days.length)]);
  const removeDay = (index) => set("route", days.filter((_, i) => i !== index).map((day, i) => ({ ...day, day: i + 1 })));

  const moveDay = (from, to) => {
    if (to < 0 || to >= days.length) return;
    const next = [...days];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    set("route", next.map((day, i) => ({ ...day, day: i + 1 })));
  };

  const toggleMeal = (index, meal) => {
    const current = days[index].meals || [];
    setDay(index, "meals", current.includes(meal) ? current.filter((item) => item !== meal) : [...current, meal]);
  };

  const generateDays = () => {
    const count = Math.max(Number(form.duration_days) || 1, 1);
    set("route", Array.from({ length: count }, (_, i) => days[i] || emptyDay(i)));
  };

  const uploadImage = async (index, file) => {
    if (!file) return;
    setUploadError("");
    setUploading(index);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setDay(index, "image", file_url);
    } catch {
      setUploadError("Chưa tải được ảnh lên. Vui lòng thử lại hoặc dán URL.");
    } finally {
      setUploading(-1);
    }
  };

  return (
    <div className="space-y-3">
      <Section title="Điểm nhấn hành trình" hint="Từng dòng một ý, kéo thả để đổi thứ tự. Hiện ở tab “Điểm nhấn” trên trang khách.">
        <LineListEditor
          items={form.highlights || []}
          onChange={(items) => set("highlights", items)}
          placeholder="VD: Ngủ đêm trên du thuyền vịnh Hạ Long"
          addLabel="Thêm điểm nhấn"
          emptyHint="Chưa có điểm nhấn nào."
        />
      </Section>

      <Section
        title="Lịch trình theo ngày"
        hint={`${days.length} ngày · mỗi ngày gồm tiêu đề, hoạt động, bữa ăn, nơi nghỉ, phương tiện và ảnh. Kéo thả để đổi thứ tự ngày.`}
      >
        <DragDropContext onDragEnd={(result) => result.destination && moveDay(result.source.index, result.destination.index)}>
          <Droppable droppableId="tour-days">
            {(dropProvided) => (
              <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-3">
                {days.map((day, index) => (
                  <Draggable key={index} draggableId={`day-${index}`} index={index}>
                    {(dragProvided) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            {...dragProvided.dragHandleProps}
                            aria-label="Kéo đổi thứ tự ngày"
                            className="mt-1 grid h-8 w-5 shrink-0 place-items-center text-slate-300 hover:text-slate-500"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand">N{index + 1}</span>
                          <div className="min-w-0 flex-1 space-y-2">
                            <input className={field} placeholder="Tiêu đề ngày (VD: Hà Nội – Vịnh Hạ Long)" value={day.title || ""} onChange={(e) => setDay(index, "title", e.target.value)} />
                            <textarea rows={2} className={area} placeholder="Hoạt động trong ngày…" value={day.description || ""} onChange={(e) => setDay(index, "description", e.target.value)} />
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">Bữa ăn</span>
                              {MEALS.map((meal) => (
                                <button
                                  key={meal}
                                  type="button"
                                  onClick={() => toggleMeal(index, meal)}
                                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                                    (day.meals || []).includes(meal) ? "bg-brand-50 text-brand" : "bg-cloud text-slate-500 hover:bg-slate-100"
                                  }`}
                                >
                                  {meal}
                                </button>
                              ))}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input className={field} placeholder="Nơi nghỉ (VD: Mường Thanh 4*)" value={day.hotel || ""} onChange={(e) => setDay(index, "hotel", e.target.value)} />
                              <input className={field} placeholder="Phương tiện (VD: Xe 45 chỗ)" value={day.transport || ""} onChange={(e) => setDay(index, "transport", e.target.value)} />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <input className={`${field} flex-1`} placeholder="Ảnh địa điểm (URL)" value={day.image || ""} onChange={(e) => setDay(index, "image", e.target.value)} />
                              <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11.5px] font-semibold text-slate-600 hover:border-brand hover:text-brand">
                                {uploading === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                                Tải ảnh
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(event) => {
                                    uploadImage(index, event.target.files?.[0]);
                                    event.target.value = "";
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-12 w-16 overflow-hidden rounded-lg bg-slate-100">
                              {day.image ? <Image src={day.image} alt={`Ngày ${index + 1}`} className="h-full w-full" fittingType="fill" /> : null}
                            </div>
                            <button
                              type="button"
                              aria-label="Xoá ngày"
                              onClick={() => removeDay(index)}
                              className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={addDay} className={ghostButton}>
            <Plus className="h-3.5 w-3.5" /> Thêm ngày
          </button>
          <button type="button" onClick={generateDays} className={ghostButton}>
            <Wand2 className="h-3.5 w-3.5" /> Sinh khung {form.duration_days} ngày
          </button>
          <span className="text-[11px] text-slate-400">Giữ nội dung đã nhập, chỉ bổ sung ngày còn thiếu.</span>
        </div>
        {uploadError ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{uploadError}</p> : null}
      </Section>
    </div>
  );
}