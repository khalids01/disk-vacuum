import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderOpenIcon,
} from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { scanTreemapQuery } from "@/features/overview/api/treemap-queries";
import type {
  ScanCategory,
  ScanSummary,
  ScanTreemapNode,
} from "@/features/scan/api/scan-api";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { formatScanCategory } from "@/features/scan/lib/scan-category";

const categoryStyles: Record<ScanCategory, string> = {
  applications: "border-sky-500/35 bg-sky-500/15 hover:bg-sky-500/25",
  documents: "border-blue-500/35 bg-blue-500/15 hover:bg-blue-500/25",
  downloads: "border-cyan-500/35 bg-cyan-500/15 hover:bg-cyan-500/25",
  images: "border-violet-500/35 bg-violet-500/15 hover:bg-violet-500/25",
  video: "border-fuchsia-500/35 bg-fuchsia-500/15 hover:bg-fuchsia-500/25",
  audio: "border-pink-500/35 bg-pink-500/15 hover:bg-pink-500/25",
  archives: "border-amber-500/35 bg-amber-500/15 hover:bg-amber-500/25",
  developer: "border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/25",
  ai: "border-teal-500/35 bg-teal-500/15 hover:bg-teal-500/25",
  caches: "border-orange-500/35 bg-orange-500/15 hover:bg-orange-500/25",
  system: "border-slate-500/35 bg-slate-500/15 hover:bg-slate-500/25",
  other: "border-zinc-500/35 bg-zinc-500/15 hover:bg-zinc-500/25",
};

interface BreadcrumbItem {
  id: number;
  name: string;
}

export function ScanTreemapSection({ summary }: { summary: ScanSummary }) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: summary.rootDirectoryId, name: summary.targetLabel },
  ]);
  const activeDirectory = breadcrumbs[breadcrumbs.length - 1] ?? {
    id: summary.rootDirectoryId,
    name: summary.targetLabel,
  };
  const treemap = useQuery(
    scanTreemapQuery(summary.completedAtUnixSeconds, activeDirectory.id),
  );

  function openNode(node: ScanTreemapNode) {
    if (node.kind !== "directory" || node.id === null) return;
    const directoryId = node.id;
    setBreadcrumbs((current) => [
      ...current,
      { id: directoryId, name: node.name },
    ]);
  }

  return (
    <SectionCard className="overflow-hidden">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Go to parent folder in space map"
            disabled={breadcrumbs.length === 1}
            onClick={() => setBreadcrumbs((current) => current.slice(0, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <nav
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm"
            aria-label="Space map path"
          >
            {breadcrumbs.map((item, index) => (
              <div key={item.id} className="flex shrink-0 items-center gap-1">
                {index > 0 && (
                  <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                )}
                <button
                  type="button"
                  className="max-w-48 truncate rounded px-1.5 py-1 font-medium hover:bg-muted"
                  onClick={() =>
                    setBreadcrumbs((current) => current.slice(0, index + 1))
                  }
                >
                  {item.name}
                </button>
              </div>
            ))}
          </nav>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {treemap.data
            ? `${treemap.data.totalItems.toLocaleString()} direct items · showing ${treemap.data.nodes.length} bounded regions`
            : "Loading space map…"}
        </p>
      </div>

      {treemap.isPending ? (
        <p className="p-5 text-sm text-muted-foreground">Loading space map…</p>
      ) : treemap.isError ? (
        <p className="p-5 text-sm text-destructive">
          {treemap.error instanceof Error
            ? treemap.error.message
            : "The space map could not be loaded."}
        </p>
      ) : treemap.data.nodes.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          This folder has no indexed content to map.
        </p>
      ) : (
        <div className="grid auto-rows-[7.5rem] grid-cols-2 gap-1 p-2 sm:grid-cols-4 lg:grid-cols-6">
          {treemap.data.nodes.map((node, index) => {
            const largestSize = treemap.data.nodes[0]?.sizeBytes ?? 1;
            const relativeSize =
              largestSize > 0 ? node.sizeBytes / largestSize : 0;
            const spanClass =
              relativeSize > 0.66
                ? "col-span-2 sm:col-span-3"
                : relativeSize > 0.25
                  ? "col-span-1 sm:col-span-2"
                  : "col-span-1";
            const canOpen = node.kind === "directory";

            return (
              <button
                key={node.id ?? `group-${index}`}
                type="button"
                disabled={!canOpen}
                className={`group min-w-0 overflow-hidden rounded-md border p-3 text-left transition-colors disabled:cursor-default ${spanClass} ${categoryStyles[node.category]}`}
                onClick={() => openNode(node)}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {node.name}
                  </span>
                  {canOpen && (
                    <FolderOpenIcon className="size-4 shrink-0 opacity-60 group-hover:opacity-100" />
                  )}
                </span>
                <span className="mt-2 block font-mono text-xs">
                  {formatBytes(node.sizeBytes)}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {node.kind === "group"
                    ? `${node.groupedItemCount.toLocaleString()} smaller items`
                    : formatScanCategory(node.category)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
