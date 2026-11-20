import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { REQUEST_STATUS_STYLE, SERVICE_REQUEST_STATUSES } from "@/lib/service-catalog";
import { formatVND } from "@/lib/format";

export default function RequestBoard({ requests, onOpen, onMove }) {
  return (
    <DragDropContext
      onDragEnd={(result) => {
        if (!result.destination) return;
        if (result.destination.droppableId === result.source.droppableId) return;
        onMove(result.draggableId, result.destination.droppableId);
      }}
    >
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {SERVICE_REQUEST_STATUSES.map((status) => {
          const rows = requests.filter((request) => request.status === status);
          return (
            <Droppable droppableId={status} key={status}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="w-[240px] shrink-0">
                  <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-card">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${REQUEST_STATUS_STYLE[status]}`}>{status}</span>
                    <span className="text-[11.5px] font-semibold text-slate-400">{rows.length}</span>
                  </div>
                  <div className="mt-2 min-h-[80px] space-y-2">
                    {rows.map((request, index) => (
                      <Draggable key={request.id} draggableId={request.id} index={index}>
                        {(dragProvided) => (
                          <button
                            type="button"
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            onClick={() => onOpen(request)}
                            className="w-full rounded-xl border border-slate-100 bg-white p-3 text-left shadow-card transition hover:border-brand/40"
                          >
                            <p className="text-[11px] font-semibold text-slate-400">{request.request_code}</p>
                            <p className="mt-0.5 line-clamp-2 text-[12.5px] font-semibold text-ink">{request.service_title}</p>
                            <p className="mt-1 text-[11.5px] text-slate-500">{request.customer_name}</p>
                            <p className="mt-1 text-[12px] font-semibold text-cta tnum">{formatVND(request.quoted_price)}</p>
                          </button>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}