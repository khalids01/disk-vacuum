import { FolderIcon, HardDriveIcon, ShieldCheckIcon } from "lucide-react";
import { SectionCard } from "@/components/core/section-card";
import type { ScanSummary } from "@/features/scan/api/scan-api";
import { ScanHomeButton } from "@/features/scan/components/scan-home-button";
import { ScanProgressPanel } from "@/features/scan/components/scan-progress-panel";
import { formatBytes } from "@/features/scan/lib/format-bytes";

interface ScanSummarySectionProps {
  summary: ScanSummary;
}

export function ScanSummarySection({ summary }: ScanSummarySectionProps) {
  const skippedCount =
    summary.permissionDeniedCount +
    summary.unreadableEntryCount +
    summary.skippedSymlinkCount +
    summary.skippedHardLinkCount +
    summary.skippedMountedFilesystemCount +
    summary.skippedSpecialFileCount;

  return (
    <div className="space-y-5">
      <ScanProgressPanel />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Indexed size"
          value={formatBytes(summary.totalSizeBytes)}
        />
        <Metric label="Files" value={summary.fileCount.toLocaleString()} />
        <Metric
          label="Folders"
          value={summary.directoryCount.toLocaleString()}
        />
        <Metric
          label="Top consumers"
          value={String(summary.topLevelItems.length)}
        />
      </div>

      <SectionCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <HardDriveIcon className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">{summary.targetLabel}</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              The largest direct items from this completed scan.
            </p>
          </div>
          <ScanHomeButton variant="outline" size="sm">
            Rescan Home
          </ScanHomeButton>
        </div>
        {summary.topLevelItems.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No readable files or folders were found in this location.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {summary.topLevelItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-primary">
                    <FolderIcon className="size-4" />
                  </div>
                  <p className="truncate text-sm font-medium">{item.name}</p>
                </div>
                <p className="shrink-0 text-sm text-muted-foreground">
                  {formatBytes(item.sizeBytes)}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {skippedCount > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p>
            {skippedCount.toLocaleString()} item
            {skippedCount === 1 ? " was" : "s were"} skipped because they were
            unreadable, special, symbolic links, duplicate hard links, or
            separate mounted filesystems.
          </p>
        </div>
      )}
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <SectionCard className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
    </SectionCard>
  );
}
