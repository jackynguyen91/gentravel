import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DefaultCatchBoundary } from "@/components/DefaultCatchBoundary";
import { requireAdmin } from "@/components/auth/AdminGate";

export const Route = createFileRoute("/_authed")({
  ssr: false,
  beforeLoad: requireAdmin,
  errorComponent: DefaultCatchBoundary,
  component: () => <Outlet />,
});