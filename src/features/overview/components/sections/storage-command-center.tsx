import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  Clock3Icon,
  FolderSearch2Icon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import type { ScanSummary } from "@/features/scan/api/scan-api";
import { formatBytes } from "@/features/scan/lib/format-bytes";

export function StorageCommandCenter({ summary }: { summary: ScanSummary }) {
  const navigate = useNavigate();
  const capacity = summary.capacity;
  const usedPercent = capacity
    ? Math.min(100, (capacity.usedSpaceBytes / capacity.totalSpaceBytes) * 100)
    : null;
  const pressure = getStoragePressure(usedPercent);
  const accountedBytes = capacity
    ? Math.min(summary.totalSizeBytes, capacity.usedSpaceBytes)
    : summary.totalSizeBytes;
  const accountedPercent =
    capacity && capacity.usedSpaceBytes > 0
      ? (accountedBytes / capacity.usedSpaceBytes) * 100
      : null;

  return (
    <SectionCard className="overflow-hidden">
      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] xl:gap-10 xl:p-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${pressure.className}`}
            >
              {pressure.label}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3Icon className="size-3.5" />
              Scanned {formatScanTime(summary.completedAtUnixSeconds)}
            </span>
          </div>

          <p className="mt-5 text-sm font-medium text-muted-foreground">
            {capacity ? "Available to you" : "Storage indexed"}
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
            {formatBytes(
              capacity?.availableSpaceBytes ?? summary.totalSizeBytes,
            )}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {capacity
              ? `${formatBytes(capacity.usedSpaceBytes)} of ${formatBytes(capacity.totalSpaceBytes)} is currently used. Review what DiskVacuum found before deciding what to reclaim.`
              : `${formatBytes(summary.totalSizeBytes)} was indexed in ${summary.targetLabel}. Explore the scan or review cleanup opportunities.`}
          </p>

          {usedPercent !== null && (
            <div className="mt-5 max-w-2xl">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Disk usage</span>
                <span className="font-medium tabular-nums">
                  {Math.round(usedPercent)}% used
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-[width] ${pressure.barClassName}`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              {capacity && capacity.reservedSpaceBytes > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatBytes(capacity.freeSpaceBytes)} physically free ·{" "}
                  {formatBytes(capacity.reservedSpaceBytes)} reserved for the
                  system
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-primary/20 bg-primary/6 p-4 sm:p-5">
          <div>
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <SparklesIcon className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">
              Find your best cleanup opportunities
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Compare duplicates, regeneratable developer files, large files, AI
              data, and application leftovers. Nothing is removed without a
              final review.
            </p>
          </div>
          <div className="mt-5 grid gap-2">
            <Button onClick={() => void navigate({ to: "/cleanup" })}>
              <ShieldCheckIcon data-icon="inline-start" />
              Review cleanup
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void navigate({
                  to: "/explorer",
                  search: { directoryId: undefined },
                })
              }
            >
              <FolderSearch2Icon data-icon="inline-start" />
              Explore files
            </Button>
          </div>
        </div>
      </div>

      <div className="grid border-t border-border bg-muted/20 sm:grid-cols-3">
        <CommandMetric
          label="Indexed file data"
          value={formatBytes(summary.totalSizeBytes)}
        />
        <CommandMetric
          label="Files inspected"
          value={summary.fileCount.toLocaleString()}
        />
        <CommandMetric
          label="Used space explained"
          value={
            accountedPercent === null
              ? "Scan complete"
              : `${Math.round(accountedPercent)}%`
          }
          detail={
            accountedPercent === null
              ? undefined
              : `${formatBytes(accountedBytes)} of allocated file data`
          }
        />
      </div>
    </SectionCard>
  );
}

function CommandMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="border-b border-border px-5 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {detail && (
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}

function getStoragePressure(percent: number | null) {
  if (percent === null) {
    return {
      label: "Scan complete",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      barClassName: "bg-primary",
    };
  }
  if (percent >= 90) {
    return {
      label: "Storage critically low",
      className: "bg-red-500/10 text-red-700 dark:text-red-300",
      barClassName: "bg-red-500",
    };
  }
  if (percent >= 80) {
    return {
      label: "Storage running low",
      className: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
      barClassName: "bg-amber-500",
    };
  }
  return {
    label: "Storage has room",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    barClassName: "bg-emerald-500",
  };
}

function formatScanTime(unixSeconds: number) {
  const date = new Date(unixSeconds * 1000);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
