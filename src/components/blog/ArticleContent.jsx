import ArticleBody from "@/components/blog/ArticleBody";
import { safeArticleHtml } from "@/lib/blog-html";

const prose = [
  "mt-7 text-[15.5px] leading-[1.85] text-slate-700",
  "[&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:font-heading [&_h2]:text-[1.35rem] [&_h2]:font-extrabold [&_h2]:leading-snug [&_h2]:text-ink",
  "[&_h3]:mb-2 [&_h3]:mt-7 [&_h3]:font-heading [&_h3]:text-[1.1rem] [&_h3]:font-bold [&_h3]:text-ink",
  "[&_p]:my-4 [&_p]:leading-[1.85]",
  "[&_strong]:font-semibold [&_strong]:text-ink",
  "[&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:decoration-brand/30 [&_a]:underline-offset-2",
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
  "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5",
  "[&_li]:leading-[1.8]",
  "[&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-brand/30 [&_blockquote]:bg-cloud [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-[14.5px] [&_blockquote]:italic",
  "[&_img]:my-5 [&_img]:w-full [&_img]:rounded-2xl",
  "[&_figure]:my-5 [&_figure]:space-y-2",
  "[&_figcaption]:text-center [&_figcaption]:text-[12px] [&_figcaption]:text-slate-500",
  "[&_iframe]:my-5 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-2xl",
  "[&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13.5px]",
  "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-cloud [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-ink",
  "[&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2",
  "[&_p[data-cta]]:my-6",
].join(" ");

// Bài mới soạn bằng trình soạn thảo (HTML), bài cũ lưu dạng chữ thuần.
export default function ArticleContent({ post }) {
  const html = String(post?.content_html || "").trim();
  if (html) {
    return <div className={prose} dangerouslySetInnerHTML={{ __html: safeArticleHtml(html, post.slug) }} />;
  }
  return <ArticleBody content={post?.content} images={post?.gallery_images} title={post?.title} />;
}