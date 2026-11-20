import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { field } from "@/components/admin/tours/form-parts";

// Danh sách dòng có kéo thả — dùng cho điểm nhấn, bao gồm, không bao gồm, lưu ý.
export default function LineListEditor({ items = [], onChange, placeholder = "Nội dung", addLabel = "Thêm dòng", emptyHint = "Chưa có nội dung." }) {
  const reorder = (from, to) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  };

  const update = (index, value) => onChange(items.map((row, i) => (i === index ? value : row)));

  return (
    <div>
      {items.length === 0 ? <p className="rounded-lg bg-cloud px-3 py-3 text-[12.5px] text-slate-500">{emptyHint}</p> : null}
      <DragDropContext onDragEnd={(result) => result.destination && reorder(result.source.index, result.destination.index)}>
        <Droppable droppableId="lines">
          {(dropProvided) => (
            <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="space-y-1.5">
              {items.map((row, index) => (
                <Draggable key={index} draggableId={`line-${index}`} index={index}>
                  {(dragProvided) => (
                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className="flex items-center gap-1.5">
                      <span {...dragProvided.dragHandleProps} className="grid h-9 w-6 shrink-0 place-items-center text-slate-300 hover:text-slate-500">
                        <GripVertical className="h-3.5 w-3.5" />
                      </span>
                      <input className={field} value={row} placeholder={placeholder} onChange={(event) => update(index, event.target.value)} />
                      <button
                        type="button"
                        aria-label="Xoá dòng"
                        onClick={() => onChange(items.filter((_, i) => i !== index))}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11.5px] font-semibold text-slate-600 hover:border-brand hover:text-brand"
      >
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  );
}