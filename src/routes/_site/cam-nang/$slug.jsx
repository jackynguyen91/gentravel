import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays } from "lucide-react";
import { Image } from "@/components/ui/image";
import ArticleContent from "@/components/blog/ArticleContent";
import ArticleSuggestions from "@/components/blog/ArticleSuggestions";
import { getPostBySlug, getPostSuggestions, getPosts, trackPostEvent } from "@/lib/server-fns";
import { formatDateVN } from "@/lib/format";

export const Route = createFileRoute("/_site/cam-nang/$slug")({
  loader: async ({ params }) => {
    const [post, posts, suggestions] = await Promise.all([
      getPostBySlug({ data: { slug: params.slug } }),
      getPosts(),
      getPostSuggestions({ data: { slug: params.slug } }),
    ]);
    return {
      post,
      related: posts.filter((item) => item.slug !== params.slug).slice(0, 2),
      suggestions,
    };
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) return {};
    const metaTitle = post.meta_title || `${post.title} – GenTravel`;
    const description = post.meta_description || post.summary || "";
    const image = post.og_image || post.thumbnail;
    return {
      meta: [
        { title: metaTitle },
        { name: "description", content: description },
        ...(post.noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
        { property: "og:type", content: "article" },
        { property: "og:title", content: metaTitle },
        { property: "og:description", content: description },
        ...(image ? [{ property: "og:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: post.canonical_url || `/cam-nang/${post.slug}` }],
    };
  },
  component: BlogDetailPage,
});

function BlogDetailPage() {
  const { post, related, suggestions } = Route.useLoaderData();
  const track = useServerFn(trackPostEvent);

  // Đếm lượt xem mỗi bài một lần trong phiên để làm báo cáo nội dung.
  useEffect(() => {
    if (!post?.slug) return;
    const key = `post-view:${post.slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    track({ data: { slug: post.slug, type: "view" } }).catch(() => null);
  }, [post?.slug, track]);

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h1 className="font-heading text-2xl font-extrabold text-ink">Không tìm thấy bài viết</h1>
        <Link to="/cam-nang" className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-white">
          Về cẩm nang du lịch
        </Link>
      </div>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.meta_title || post.title,
    description: post.meta_description || post.summary,
    image: post.og_image || post.thumbnail,
    datePublished: post.published_at,
    dateModified: post.updated_date,
    author: { "@type": "Person", name: post.author || "GenTravel" },
    publisher: { "@type": "Organization", name: "GenTravel" },
  };

  return (
    <article className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <Link to="/cam-nang" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
          ← Cẩm nang du lịch
        </Link>
        <div className="mt-4 flex items-center gap-2 text-[11.5px] font-medium text-slate-500">
          <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand">{post.category}</span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formatDateVN(post.published_at)}
          </span>
        </div>
        <h1 className="mt-3 font-heading text-[clamp(1.6rem,4.4vw,2.4rem)] font-extrabold leading-tight tracking-tight text-ink">
          {post.title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{post.summary}</p>

        <div className="mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-slate-100">
          <Image src={post.thumbnail} alt={post.title} className="h-full w-full" fittingType="fill" />
        </div>

        <ArticleContent post={post} />

        <ArticleSuggestions
          post={post}
          tours={suggestions?.tours || []}
          services={suggestions?.services || []}
        />
      </div>

      {related.length > 0 && (
        <div className="mx-auto max-w-3xl border-t border-slate-100 px-5 py-10 sm:px-8">
          <h2 className="font-heading text-lg font-extrabold text-ink">Bài viết khác</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {related.map((item) => (
              <Link
                key={item.slug}
                to="/cam-nang/$slug"
                params={{ slug: item.slug }}
                className="group flex gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-brand/40"
              >
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  <Image src={item.thumbnail} alt={item.title} className="h-full w-full" fittingType="fill" />
                </div>
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand">{item.category}</p>
                  <p className="mt-1 line-clamp-2 font-heading text-[13.5px] font-bold leading-snug text-ink group-hover:text-brand">
                    {item.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}