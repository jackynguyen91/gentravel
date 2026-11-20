import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Clock, MapPin, Star } from "lucide-react";
import { Image } from "@/components/ui/image";
import { trackPostEvent } from "@/lib/server-fns";
import { durationLabel, finalPrice, formatVND } from "@/lib/format";

// Khối gợi ý tour / dịch vụ cuối bài viết, mang theo mã bài để ghi nguồn khi khách đặt.
export default function ArticleSuggestions({ post, tours = [], services = [] }) {
  const track = useServerFn(trackPostEvent);
  const trackCta = () => {
    track({ data: { slug: post.slug, type: "cta" } }).catch(() => null);
  };

  if (!tours.length && !services.length) return null;

  return (
    <section className="mt-10 rounded-2xl border border-slate-100 bg-cloud p-5 sm:p-6">
      {tours.length > 0 && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-heading text-lg font-extrabold text-ink">Tour phù hợp với bạn</h2>
              <p className="mt-0.5 text-[12.5px] text-slate-500">
                Chọn từ {tours.length} hành trình GenTravel đang bán cho điểm đến này.
              </p>
            </div>
            <Link
              to="/tours"
              onClick={trackCta}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:gap-2"
            >
              Xem tất cả tour <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {tours.map((tour) => (
              <Link
                key={tour.id}
                to="/tours/$slug"
                params={{ slug: tour.slug }}
                search={{ bai_viet: post.slug }}
                onClick={trackCta}
                className="group flex gap-3 overflow-hidden rounded-xl border border-slate-100 bg-white p-2.5 transition hover:border-brand/40 hover:shadow-card"
              >
                <div className="h-[74px] w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  <Image
                    src={tour.cover_image}
                    alt={tour.title}
                    className="h-full w-full transition duration-500 group-hover:scale-105"
                    fittingType="fill"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 font-heading text-[13.5px] font-bold leading-snug text-ink group-hover:text-brand">
                    {tour.title}
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {tour.destination}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {durationLabel(tour.duration_days, tour.duration_nights)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-ink">
                      <Star className="h-3 w-3 fill-sun text-sun" />
                      {Number(tour.rating || 0).toFixed(1)}
                    </span>
                  </p>
                  <p className="mt-1 font-heading text-[13.5px] font-extrabold text-cta">
                    {formatVND(finalPrice(tour))}
                    <span className="ml-1 text-[10.5px] font-medium text-slate-500">/khách</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {services.length > 0 && (
        <div className={tours.length ? "mt-5 border-t border-slate-200 pt-4" : ""}>
          <h2 className="font-heading text-[15px] font-extrabold text-ink">Dịch vụ đi kèm</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">Đặt riêng vé máy bay, khách sạn, visa hoặc đưa đón.</p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {services.map((service) => (
              <Link
                key={service.id}
                to="/dich-vu-khac"
                onClick={trackCta}
                className="group flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 transition hover:border-brand/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink group-hover:text-brand">{service.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {service.type}
                    {Number(service.price) > 0 ? ` · từ ${formatVND(service.price)}` : ""}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}