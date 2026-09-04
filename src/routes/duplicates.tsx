import { createFileRoute } from "@tanstack/react-router";
import { DuplicatesPage } from "@/features/duplicates/pages/duplicates-page";

export const Route = createFileRoute("/duplicates")({
  component: DuplicatesPage,
});
