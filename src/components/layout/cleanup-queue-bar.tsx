import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ListChecksIcon, XIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { useCleanupQueueStore } from "@/stores/cleanup-queue-store";

export function CleanupQueueBar() {
  const navigate = useNavigate();
  const scanQuery = useQuery(currentScanQuery);
  const scan = scanQuery.data;
  const items = useCleanupQueueStore((state) => state.items);
  const scanVersion = useCleanupQueueStore((state) => state.scanVersion);
  const clear = useCleanupQueueStore((state) => state.clear);
  useEffect(() => {
    if (
      !scanQuery.isPending &&
      scan &&
      scanVersion !== null &&
      scan.completedAtUnixSeconds !== scanVersion
    )
      clear();
  }, [clear, scan, scanQuery.isPending, scanVersion]);
  if (!items.size) return null;
  const size = [...items.values()].reduce(
    (total, item) => total + item.sizeBytes,
    0,
  );
  return (
    <div className="absolute inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-[0_22px_55px_-22px_rgb(0_0_0_/_0.8)] backdrop-blur-xl">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <ListChecksIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {items.size.toLocaleString()} in Cleanup Queue
        </p>
        <p className="text-xs text-muted-foreground">
          Up to {formatBytes(size)} selected
        </p>
      </div>
      <Button size="sm" onClick={() => void navigate({ to: "/cleanup-queue" })}>
        Review
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Clear Cleanup Queue"
        onClick={clear}
      >
        <XIcon />
      </Button>
    </div>
  );
}
