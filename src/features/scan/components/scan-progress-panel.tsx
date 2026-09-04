import { LoaderCircleIcon } from "lucide-react";
import { SectionCard } from "@/components/core/section-card";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { useScanStore } from "@/stores/scan-store";

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function ScanProgressPanel() {
  const status = useScanStore((state) => state.status);
  const progress = useScanStore((state) => state.progress);

  if (status !== "scanning") {
    return null;
  }

  return (
    <SectionCard
      className="overflow-hidden p-5"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <LoaderCircleIcon className="size-4 animate-spin" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Scanning {progress?.targetLabel ?? "selected location"}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {formatElapsed(progress?.elapsedMilliseconds ?? 0)} elapsed
            </p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/5 animate-pulse rounded-full bg-primary" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {(progress?.entriesVisited ?? 0).toLocaleString()} items inspected ·{" "}
            {formatBytes(progress?.bytesObserved ?? 0)} observed
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Total item count is discovered during the scan, so this is a live
            activity indicator rather than an inaccurate percentage.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
