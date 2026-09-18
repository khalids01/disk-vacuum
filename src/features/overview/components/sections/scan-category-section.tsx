import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/core/section-card";
import { ScanExplorer } from "@/features/explorer/pages/explorer-page";
import type { ScanCategory, ScanSummary } from "@/features/scan/api/scan-api";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { formatScanCategory } from "@/features/scan/lib/scan-category";

export function ScanCategorySection({ summary }: { summary: ScanSummary }) {
  const [activeCategory, setActiveCategory] = useState<ScanCategory | null>(
    null,
  );

  if (summary.categories.length === 0) return null;

  if (activeCategory) {
    return (
      <ScanExplorer
        key={activeCategory}
        summary={summary}
        category={activeCategory}
        onExit={() => setActiveCategory(null)}
      />
    );
  }

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
            <button
              type="button"
              key={item.category}
              className="group block w-full px-5 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              aria-label={`Browse ${formatScanCategory(item.category)} storage`}
              onClick={() => setActiveCategory(item.category)}
            >
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium">
                  {formatScanCategory(item.category)}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground sm:text-sm">
                    {formatBytes(item.sizeBytes)} ·{" "}
                    {item.fileCount.toLocaleString()} files
                  </span>
                  <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${categoryBarStyles[item.category]}`}
                  style={{ width: `${Math.max(percent, 0.5)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

const categoryBarStyles: Record<ScanCategory, string> = {
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
  other: "bg-zinc-500",
};
