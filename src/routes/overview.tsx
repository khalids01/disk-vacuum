import { createFileRoute } from "@tanstack/react-router";
import { OverviewPage } from "@/features/overview/pages/overview-page";

export const Route = createFileRoute("/overview")({
  component: OverviewPage,
});
