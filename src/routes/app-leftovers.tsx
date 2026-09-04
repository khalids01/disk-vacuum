import { createFileRoute } from "@tanstack/react-router";
import { AppLeftoversPage } from "@/features/app-leftovers/pages/app-leftovers-page";

export const Route = createFileRoute("/app-leftovers")({
  component: AppLeftoversPage,
});
