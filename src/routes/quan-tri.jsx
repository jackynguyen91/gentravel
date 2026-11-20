import { createFileRoute } from "@tanstack/react-router";
import { AdminLoginPage } from "@/components/auth/AdminLoginPage";

export const Route = createFileRoute("/quan-tri")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Quản trị GenTravel" },
      { name: "description", content: "Khu vực quản trị nội bộ GenTravel." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});