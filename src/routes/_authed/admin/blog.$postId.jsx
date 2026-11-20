import { createFileRoute, Link } from "@tanstack/react-router";
import PostEditor from "@/components/admin/blog/PostEditor";
import { listBlogAdmin } from "@/lib/admin-blog-fns";

export const Route = createFileRoute("/_authed/admin/blog/$postId")({
  loader: () => listBlogAdmin(),
  head: () => ({ meta: [{ title: "Soạn bài viết – GenTravel" }] }),
  component: BlogEditorPage,
});

function BlogEditorPage() {
  const data = Route.useLoaderData();
  const { postId } = Route.useParams();
  const isNew = postId === "new";
  const post = isNew ? null : data.posts.find((item) => item.id === postId);

  if (!isNew && !post) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <p className="font-heading text-lg font-bold text-ink">Không tìm thấy bài viết</p>
        <Link to="/admin/blog" className="mt-3 inline-flex h-9 items-center rounded-lg bg-brand px-4 text-[12.5px] font-semibold text-white">
          Về danh sách bài viết
        </Link>
      </div>
    );
  }

  return (
    <PostEditor
      key={post?.id || "new"}
      post={post}
      options={data.options}
      categories={(data.activeCategories || []).length ? data.activeCategories : ["Kinh nghiệm"]}
      userId={data.userId}
      canApprove={data.canApprove}
      canWrite={data.canWrite}
    />
  );
}