import { ShieldCheckIcon } from "lucide-react";
import { OverviewCleanupPanel } from "@/features/overview/components/sections/overview-cleanup-panel";
import { ScanCategorySection } from "@/features/overview/components/sections/scan-category-section";
import { ScanTreemapSection } from "@/features/overview/components/sections/scan-treemap-section";
import { StorageCommandCenter } from "@/features/overview/components/sections/storage-command-center";
import type { ScanSummary } from "@/features/scan/api/scan-api";
import { ScanProgressPanel } from "@/features/scan/components/scan-progress-panel";

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
    <div className="space-y-6">
      <ScanProgressPanel />
      <StorageCommandCenter summary={summary} />
      <ScanTreemapSection
        summary={summary}
        aside={
          <OverviewCleanupPanel summary={summary} skippedCount={skippedCount} />
        }
      />

      <ScanCategorySection summary={summary} />

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
