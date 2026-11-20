import { CalendarDays, PhoneCall } from "lucide-react";
import { formatVND } from "@/lib/format";

const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function dateParts(iso) {
  const date = new Date(`${String(iso || "").slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return {
    iso: String(iso).slice(0, 10),
    day: String(date.getDate()).padStart(2, "0"),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    year: date.getFullYear(),
    weekday: WEEKDAYS[date.getDay()],
  };
}

export default function TourDepartureDates({ tour, departures }) {
  // Ưu tiên ngày đang mở bán & còn chỗ; chưa có kỳ nào thì giữ danh sách cũ trên tour.
  const source = Array.isArray(departures) && departures.length
    ? departures.map((row) => ({ iso: row.date, remaining: row.remaining, price_override: row.price_override }))
    : (tour.departure_dates || []).map((iso) => ({ iso, remaining: null, price_override: 0 }));

  const dates = source
    .map((row) => {
      const parts = dateParts(row.iso);
      return parts ? { ...parts, remaining: row.remaining, price_override: row.price_override } : null;
    })
    .filter(Boolean);

  if (!dates.length) {
    return (
      <p className="text-[14px] leading-relaxed text-slate-600">
        Lịch khởi hành đang được cập nhật. Vui lòng gọi 1900 6789 để được tư vấn ngày gần nhất.
      </p>
    );
  }

  return (
    <div>
      <p className="text-[13.5px] leading-relaxed text-slate-600">
        Các ngày khởi hành dự kiến, khởi hành từ {(tour.departure_points || [tour.departure_point]).join(", ")}.
      </p>
      <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
        {dates.map((item, index) => (
          <li key={item.iso} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
            <span className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-center leading-none">
                <span className="font-heading text-[15px] font-extrabold text-brand">{item.day}</span>
                <span className="text-[10px] font-semibold text-brand/70">th{item.month}</span>
              </span>
              <span>
                <span className="block text-[13.5px] font-semibold text-ink">
                  {item.weekday}, {item.day}/{item.month}/{item.year}
                </span>
                <span className="block text-[12px] text-slate-500">
                  {index === 0 ? "Khởi hành gần nhất" : "Còn nhận khách"}
                  {item.remaining != null ? ` · còn ${item.remaining} chỗ` : ""} ·{" "}
                  {formatVND(item.price_override || tour.price_adult)}
                </span>
              </span>
            </span>
            <a
              href="#booking"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-[12.5px] font-semibold text-brand transition hover:bg-brand hover:text-white"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Chọn ngày này
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-slate-500">
        <PhoneCall className="h-3.5 w-3.5 text-brand" />
        Cần ngày khác? Gọi 1900 6789 để GenTravel xếp lịch riêng cho bạn.
      </p>
    </div>
  );
}