import { Clock3Icon } from "lucide-react";
import { SectionCard } from "@/components/core/section-card";
import type { ScanCategory, ScanSummary } from "@/features/scan/api/scan-api";
import { ScanHomeButton } from "@/features/scan/components/scan-home-button";
import { ScanSystemButton } from "@/features/scan/components/scan-system-button";
import { formatBytes } from "@/features/scan/lib/format-bytes";

const segmentColors: Record<ScanCategory, string> = {
  applications: "bg-emerald-500",
  documents: "bg-sky-500",
  downloads: "bg-cyan-500",
  images: "bg-violet-500",
  video: "bg-fuchsia-500",
  audio: "bg-pink-500",
  archives: "bg-rose-500",
  developer: "bg-teal-500",
  ai: "bg-indigo-500",
  caches: "bg-lime-600",
  system: "bg-cyan-600",
  other: "bg-slate-500",
};

export function StorageCommandCenter({ summary }: { summary: ScanSummary }) {
  const capacity = summary.capacity;
  const usedPercent = capacity
    ? Math.min(100, (capacity.usedSpaceBytes / capacity.totalSpaceBytes) * 100)
    : null;
  const denominator = capacity?.totalSpaceBytes ?? summary.totalSizeBytes;
  const pressure = getStoragePressure(usedPercent);

  return (
    <SectionCard className="overflow-hidden border-primary/15 bg-card/90 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold">{summary.targetLabel}</h2>
            <span className={`text-xs font-bold ${pressure.className}`}>
              {pressure.label}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock3Icon className="size-3" />
            Scanned {formatScanTime(summary.completedAtUnixSeconds)}
          </p>
        </div>
        {capacity ? (
          <ScanSystemButton size="sm">Scan again</ScanSystemButton>
        ) : (
          <ScanHomeButton size="sm">Scan again</ScanHomeButton>
        )}
      </div>

      <div className="mt-4 flex h-2.5 gap-1 overflow-hidden rounded-sm bg-muted">
        {summary.categories.map((category) => (
          <span
            key={category.category}
            className={`h-full min-w-0 rounded-sm ${segmentColors[category.category]}`}
            style={{
              width: `${denominator > 0 ? (category.sizeBytes / denominator) * 100 : 0}%`,
            }}
            title={`${category.category}: ${formatBytes(category.sizeBytes)}`}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-4 text-[11px]">
        <span className="font-semibold">
          {capacity
            ? `${formatBytes(capacity.usedSpaceBytes)} used`
            : `${formatBytes(summary.totalSizeBytes)} indexed`}
        </span>
        <span className="text-muted-foreground">
          {capacity
            ? `${formatBytes(capacity.availableSpaceBytes)} available`
            : `${summary.fileCount.toLocaleString()} files`}
        </span>
      </div>
    </SectionCard>
  );
}

function getStoragePressure(percent: number | null) {
  if (percent === null) {
    return { label: "Scan complete", className: "text-primary" };
  }
  if (percent >= 90) {
    return {
      label: `${Math.round(percent)}% full`,
      className: "text-red-400",
    };
  }
  if (percent >= 80) {
    return {
      label: `${Math.round(percent)}% full`,
      className: "text-amber-400",
    };
  }
  return {
    label: `${Math.round(percent)}% full`,
    className: "text-primary",
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
