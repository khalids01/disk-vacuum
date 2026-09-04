import { createFileRoute } from "@tanstack/react-router";
import { AiStoragePage } from "@/features/ai-storage/pages/ai-storage-page";

export const Route = createFileRoute("/ai-storage")({
  component: AiStoragePage,
});
