import { ListPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CleanupTarget } from "@/features/cleanup/api/cleanup-api";
import type { CleanupSource } from "@/stores/cleanup-queue-store";
import { useCleanupQueueStore } from "@/stores/cleanup-queue-store";

export function AddToCleanupQueueButton({
  items,
  source,
  scanVersion,
  onAdded,
  label = "Add to Cleanup Queue",
  requireRegeneratable = false,
}: {
  items: CleanupTarget[];
  source: CleanupSource;
  scanVersion: number;
  onAdded?: () => void;
  label?: string;
  requireRegeneratable?: boolean;
}) {
  const add = useCleanupQueueStore((state) => state.add);
  return (
    <Button
      onClick={() => {
        add(
          items.map((item) => ({
            ...item,
            source,
            nodeKind: source === "largeFiles" ? "file" : "directory",
            requireRegeneratable,
          })),
          scanVersion,
        );
        onAdded?.();
      }}
    >
      <ListPlusIcon data-icon="inline-start" />
      {label}
    </Button>
  );
}
