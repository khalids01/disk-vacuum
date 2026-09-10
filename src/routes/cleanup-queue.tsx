import { createFileRoute } from "@tanstack/react-router";
import { CleanupQueuePage } from "@/features/cleanup/pages/cleanup-queue-page";
export const Route = createFileRoute("/cleanup-queue")({
  component: CleanupQueuePage,
});
