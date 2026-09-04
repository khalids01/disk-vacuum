import { createFileRoute } from "@tanstack/react-router";
import { DeveloperCleanupPage } from "@/features/developer-cleanup/pages/developer-cleanup-page";

export const Route = createFileRoute("/developer-cleanup")({
  component: DeveloperCleanupPage,
});
