import { SectionCard } from "@/components/core/section-card";
import type { ScanSummary } from "@/features/scan/api/scan-api";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { formatScanCategory } from "@/features/scan/lib/scan-category";

export function ScanCategorySection({ summary }: { summary: ScanSummary }) {
  if (summary.categories.length === 0) return null;

  return (
    <SectionCard className="overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">Storage by category</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Classified from file types and storage locations.
        </p>
      </div>
      <div className="divide-y divide-border">
        {summary.categories.map((item) => {
          const percent =
            summary.totalSizeBytes > 0
              ? (item.sizeBytes / summary.totalSizeBytes) * 100
              : 0;

          return (
            <div key={item.category} className="px-5 py-3">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium">
                  {formatScanCategory(item.category)}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground sm:text-sm">
                  {formatBytes(item.sizeBytes)} ·{" "}
                  {item.fileCount.toLocaleString()} files
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(percent, 0.5)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
