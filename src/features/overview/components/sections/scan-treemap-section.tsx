import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderOpenIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { scanTreemapQuery } from "@/features/overview/api/treemap-queries";
import { ScanNodeDetailsPanel } from "@/features/overview/components/sections/scan-node-details-panel";
import { createTreemapLayout } from "@/features/overview/lib/treemap-layout";
import type {
  ScanCategory,
  ScanSummary,
  ScanTreemapNode,
} from "@/features/scan/api/scan-api";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { formatScanCategory } from "@/features/scan/lib/scan-category";

const categoryStyles: Record<ScanCategory, string> = {
  applications:
    "border-emerald-400/70 bg-emerald-600/85 hover:bg-emerald-500/90",
  documents: "border-sky-400/70 bg-sky-600/85 hover:bg-sky-500/90",
  downloads: "border-cyan-400/70 bg-cyan-600/85 hover:bg-cyan-500/90",
  images: "border-violet-400/70 bg-violet-600/85 hover:bg-violet-500/90",
  video: "border-fuchsia-400/70 bg-fuchsia-600/85 hover:bg-fuchsia-500/90",
  audio: "border-pink-400/70 bg-pink-600/85 hover:bg-pink-500/90",
  archives: "border-amber-300/70 bg-amber-600/85 hover:bg-amber-500/90",
  developer: "border-teal-400/70 bg-teal-600/85 hover:bg-teal-500/90",
  ai: "border-indigo-400/70 bg-indigo-600/85 hover:bg-indigo-500/90",
  caches: "border-orange-300/70 bg-orange-600/85 hover:bg-orange-500/90",
  system: "border-amber-300/70 bg-amber-600/85 hover:bg-amber-500/90",
  other: "border-slate-400/70 bg-slate-600/85 hover:bg-slate-500/90",
};

interface BreadcrumbItem {
  id: number;
  name: string;
}

export function ScanTreemapSection({ summary }: { summary: ScanSummary }) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: summary.rootDirectoryId, name: summary.targetLabel },
  ]);
  const [selectedNode, setSelectedNode] = useState<ScanTreemapNode | null>(
    null,
  );
  const activeDirectory = breadcrumbs[breadcrumbs.length - 1] ?? {
    id: summary.rootDirectoryId,
    name: summary.targetLabel,
  };
  const treemap = useQuery(
    scanTreemapQuery(summary.completedAtUnixSeconds, activeDirectory.id),
  );
  const rectangles = useMemo(
    () => createTreemapLayout(treemap.data?.nodes ?? []),
    [treemap.data?.nodes],
  );
  const directories =
    treemap.data?.nodes.filter((node) => node.kind === "directory") ?? [];

  function openNode(node: ScanTreemapNode) {
    if (node.kind !== "directory" || node.id === null) return;
    const directoryId = node.id;
    setBreadcrumbs((current) => [
      ...current,
      { id: directoryId, name: node.name },
    ]);
    setSelectedNode(null);
  }

  function selectNode(node: ScanTreemapNode) {
    if (node.id !== null) setSelectedNode(node);
  }

  function openBreadcrumb(index: number) {
    setBreadcrumbs((current) => current.slice(0, index + 1));
    setSelectedNode(null);
  }

  const selectedNodeId = selectedNode?.id ?? null;

  return (
    <SectionCard className="overflow-visible border-primary/15 bg-card/90">
      <div className="sticky top-0 z-20 rounded-t-lg border-b border-border bg-card/95 px-4 py-4 backdrop-blur sm:px-5">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Go to parent folder in space map"
            disabled={breadcrumbs.length === 1}
            onClick={() => {
              setBreadcrumbs((current) => current.slice(0, -1));
              setSelectedNode(null);
            }}
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
                  onClick={() => openBreadcrumb(index)}
                >
                  {item.name}
                </button>
              </div>
            ))}
          </nav>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {treemap.data
            ? `${treemap.data.totalItems.toLocaleString()} direct items · ${treemap.data.nodes.length} bounded regions · select once, open folders with double-click or Enter`
            : "Loading space map…"}
        </p>
      </div>

      <div
        className={
          selectedNodeId === null
            ? undefined
            : "lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]"
        }
      >
        <div className="min-w-0">
          {treemap.isPending ? (
            <p className="p-5 text-sm text-muted-foreground">
              Loading space map…
            </p>
          ) : treemap.isError ? (
            <p className="p-5 text-sm text-destructive">
              {treemap.error instanceof Error
                ? treemap.error.message
                : "The space map could not be loaded."}
            </p>
          ) : rectangles.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              This folder has no sized indexed content to map.
            </p>
          ) : (
            <>
              <section
                className="relative h-[22rem] overflow-hidden bg-[#09140f] p-1 sm:h-[30rem]"
                aria-label={`Storage map for ${activeDirectory.name}`}
              >
                {rectangles.map((rectangle, index) => {
                  const { node } = rectangle;
                  const canOpen = node.kind === "directory";
                  const isSelected =
                    node.id !== null && node.id === selectedNodeId;
                  const showDetails =
                    rectangle.width >= 12 && rectangle.height >= 10;
                  return (
                    <button
                      key={node.id ?? `group-${index}`}
                      type="button"
                      disabled={node.id === null}
                      aria-pressed={node.id === null ? undefined : isSelected}
                      title={`${node.name} · ${formatBytes(node.sizeBytes)} · ${formatScanCategory(node.category)}`}
                      className={`group absolute overflow-hidden rounded border p-2 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default ${isSelected ? "z-10 ring-2 ring-primary ring-offset-1 ring-offset-background" : ""} ${categoryStyles[node.category]}`}
                      style={{
                        left: `${rectangle.x}%`,
                        top: `${rectangle.y}%`,
                        width: `calc(${rectangle.width}% - 2px)`,
                        height: `calc(${rectangle.height}% - 2px)`,
                      }}
                      onClick={() => selectNode(node)}
                      onDoubleClick={() => openNode(node)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && canOpen) {
                          event.preventDefault();
                          openNode(node);
                        }
                      }}
                    >
                      <span className="flex min-w-0 items-start justify-between gap-1">
                        <span className="truncate text-xs font-semibold sm:text-sm">
                          {node.name}
                        </span>
                        {canOpen && showDetails && (
                          <FolderOpenIcon className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                        )}
                      </span>
                      {showDetails && (
                        <>
                          <span className="mt-1 block font-mono text-[11px]">
                            {formatBytes(node.sizeBytes)}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-white/65">
                            {node.kind === "group"
                              ? `${node.groupedItemCount.toLocaleString()} smaller items`
                              : formatScanCategory(node.category)}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </section>

              {directories.length > 0 && (
                <div className="border-t border-border">
                  <div className="px-4 py-3 sm:px-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Directories in this map
                    </h3>
                  </div>
                  <div className="divide-y divide-border">
                    {directories.map((directory) => {
                      const isSelected = directory.id === selectedNodeId;
                      return (
                        <button
                          key={directory.id}
                          type="button"
                          aria-pressed={isSelected}
                          className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 ${isSelected ? "bg-primary/10" : ""}`}
                          onClick={() => selectNode(directory)}
                          onDoubleClick={() => openNode(directory)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              openNode(directory);
                            }
                          }}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <FolderOpenIcon className="size-4 shrink-0 text-primary" />
                            <span className="truncate text-sm font-medium">
                              {directory.name}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground sm:text-sm">
                            {formatBytes(directory.sizeBytes)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {selectedNodeId !== null && (
          <ScanNodeDetailsPanel
            scanVersion={summary.completedAtUnixSeconds}
            directoryId={activeDirectory.id}
            nodeId={selectedNodeId}
            onClose={() => setSelectedNode(null)}
            onOpenDirectory={() => {
              if (selectedNode) openNode(selectedNode);
            }}
          />
        )}
      </div>
    </SectionCard>
  );
}
