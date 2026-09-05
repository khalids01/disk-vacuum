import { useMutation } from "@tanstack/react-query";
import { CircleStopIcon, LoaderCircleIcon, OctagonXIcon } from "lucide-react";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import {
  cancelCurrentScan,
  normalizeScanError,
} from "@/features/scan/api/scan-api";
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
  const requestCancellation = useScanStore(
    (state) => state.requestCancellation,
  );
  const failScan = useScanStore((state) => state.failScan);
  const cancellation = useMutation({
    mutationFn: cancelCurrentScan,
    onMutate: requestCancellation,
    onSuccess: (accepted) => {
      if (!accepted) {
        failScan("There is no active scan to cancel.");
      }
    },
    onError: (error) => {
      failScan(normalizeScanError(error).message);
    },
  });

  if (status === "cancelled") {
    return (
      <SectionCard className="p-5" aria-live="polite">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <OctagonXIcon className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Scan cancelled</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No partial result was saved. Your previous completed scan, if any,
              is still available.
            </p>
          </div>
        </div>
      </SectionCard>
    );
  }

  if (status !== "scanning" && status !== "cancelling") {
    return null;
  }

  const isCancelling = status === "cancelling";
  const observedBytes = progress?.bytesObserved ?? 0;
  const usedSpaceBytes = progress?.capacity?.usedSpaceBytes ?? 0;
  const estimatedPercent =
    usedSpaceBytes > 0
      ? Math.min(100, (observedBytes / usedSpaceBytes) * 100)
      : null;
  const percentLabel =
    estimatedPercent === null
      ? null
      : `${estimatedPercent < 1 ? estimatedPercent.toFixed(1) : Math.round(estimatedPercent)}%`;

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
              {isCancelling
                ? "Stopping scan…"
                : `Scanning ${progress?.targetLabel ?? "selected location"}`}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {formatElapsed(progress?.elapsedMilliseconds ?? 0)} elapsed
            </p>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              estimatedPercent === null
                ? undefined
                : Math.round(estimatedPercent)
            }
          >
            <div
              className={
                estimatedPercent === null
                  ? "h-full w-2/5 animate-pulse rounded-full bg-primary"
                  : "h-full rounded-full bg-primary transition-[width] duration-300"
              }
              style={
                estimatedPercent === null
                  ? undefined
                  : { width: `${estimatedPercent}%` }
              }
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {percentLabel ? `${percentLabel} · ` : ""}
              {(progress?.entriesVisited ?? 0).toLocaleString()} items inspected
              · {formatBytes(observedBytes)} observed
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!progress || isCancelling || cancellation.isPending}
              onClick={() => cancellation.mutate()}
            >
              <CircleStopIcon data-icon="inline-start" />
              {isCancelling ? "Stopping" : "Cancel"}
            </Button>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {progress?.capacity ? (
              <>
                Estimated from {formatBytes(progress.capacity.usedSpaceBytes)}{" "}
                used across {formatBytes(progress.capacity.totalSpaceBytes)}{" "}
                total capacity. Protected and filesystem-managed space can
                differ.
              </>
            ) : (
              <>
                Total item count is discovered during the scan, so folder scans
                use a live activity indicator.
              </>
            )}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
