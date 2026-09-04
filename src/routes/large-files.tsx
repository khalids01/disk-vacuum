import { createFileRoute } from "@tanstack/react-router";
import { LargeFilesPage } from "@/features/large-files/pages/large-files-page";

export const Route = createFileRoute("/large-files")({
  component: LargeFilesPage,
});
