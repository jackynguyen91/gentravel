import { createFileRoute } from "@tanstack/react-router";
import AdminLayout from "@/components/admin/AdminLayout";

export const Route = createFileRoute("/_authed/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Quản trị GenTravel" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});