import { createFileRoute } from "@tanstack/react-router";
import { ExplorerPage } from "@/features/explorer/pages/explorer-page";

interface ExplorerSearch {
  directoryId?: number;
}

export const Route = createFileRoute("/explorer")({
  validateSearch: (search: Record<string, unknown>): ExplorerSearch => {
    const directoryId = Number(search.directoryId);
    return {
      directoryId:
        Number.isSafeInteger(directoryId) && directoryId >= 0
          ? directoryId
          : undefined,
    };
  },
  component: ExplorerPage,
});
