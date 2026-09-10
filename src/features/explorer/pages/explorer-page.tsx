import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  ListPlusIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/core/page-header";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  scanBreadcrumbsQuery,
  scanDirectoryQuery,
} from "@/features/explorer/api/explorer-queries";
import { ExplorerEmptySection } from "@/features/explorer/components/sections/explorer-empty-section";
import type {
  ScanBreadcrumbItem,
  ScanNodeSummary,
  ScanSummary,
} from "@/features/scan/api/scan-api";
import { getScanNodeDetails } from "@/features/scan/api/scan-api";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { formatScanCategory } from "@/features/scan/lib/scan-category";
import { useCleanupQueueStore } from "@/stores/cleanup-queue-store";

const PAGE_SIZE = 100;

export function ExplorerPage() {
  const { data: currentScan } = useQuery(currentScanQuery);
  const { directoryId } = useSearch({ from: "/explorer" });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Explorer"
        title="Browse storage by folder"
        description="Follow your scanned folders from the root down without rescanning the filesystem."
      />
      {currentScan ? (
        <ScanExplorer
          key={
            String(currentScan.completedAtUnixSeconds) +
            "-" +
            String(directoryId)
          }
          summary={currentScan}
          initialDirectoryId={directoryId}
        />
      ) : (
        <ExplorerEmptySection />
      )}
    </div>
  );
}

function ScanExplorer({
  summary,
  initialDirectoryId,
}: {
  summary: ScanSummary;
  initialDirectoryId?: number;
}) {
  const startsAtRoot =
    initialDirectoryId === undefined ||
    initialDirectoryId === summary.rootDirectoryId;
  const [breadcrumbs, setBreadcrumbs] = useState<ScanBreadcrumbItem[]>([
    startsAtRoot
      ? { id: summary.rootDirectoryId, name: summary.targetLabel }
      : { id: initialDirectoryId, name: "Selected location" },
  ]);
  const initialBreadcrumbs = useQuery(
    scanBreadcrumbsQuery(
      summary.completedAtUnixSeconds,
      initialDirectoryId ?? summary.rootDirectoryId,
    ),
  );
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Map<number, ScanNodeSummary>>(
    new Map(),
  );
  const addToQueue = useCleanupQueueStore((state) => state.add);
  useEffect(() => {
    if (initialBreadcrumbs.data) {
      setBreadcrumbs(initialBreadcrumbs.data);
      setOffset(0);
    }
  }, [initialBreadcrumbs.data]);
  const activeDirectory = breadcrumbs[breadcrumbs.length - 1] ?? breadcrumbs[0];
  const directory = useQuery(
    scanDirectoryQuery(
      summary.completedAtUnixSeconds,
      activeDirectory.id,
      offset,
      PAGE_SIZE,
    ),
  );
  const page = directory.data;
  const pageEnd = page ? page.offset + page.items.length : 0;
  const queueMutation = useMutation({
    mutationFn: async () =>
      Promise.all(
        [...selected.values()].map((item) =>
          getScanNodeDetails(activeDirectory.id, item.id),
        ),
      ),
    onSuccess: (items) => {
      addToQueue(
        items.map((item) => ({
          id: item.id,
          parentDirectoryId: item.parentDirectoryId,
          path: item.path,
          name: item.name,
          sizeBytes: item.sizeBytes,
          source: "explorer",
          nodeKind: item.kind,
        })),
        summary.completedAtUnixSeconds,
      );
      setSelected(new Map());
    },
  });

  function toggleItem(item: ScanNodeSummary) {
    if (item.category === "system") return;
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }

  function openDirectory(id: number, name: string) {
    setBreadcrumbs((current) => [...current, { id, name }]);
    setOffset(0);
  }

  function openBreadcrumb(index: number) {
    setBreadcrumbs((current) => current.slice(0, index + 1));
    setOffset(0);
  }

  function goBack() {
    setBreadcrumbs((current) =>
      current.length > 1 ? current.slice(0, -1) : current,
    );
    setOffset(0);
  }

  return (
    <SectionCard className="overflow-hidden">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Go to parent folder"
            disabled={breadcrumbs.length === 1}
            onClick={goBack}
          >
            <ChevronLeftIcon />
          </Button>
          <nav
            className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm"
            aria-label="Scanned folder path"
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
          {page
            ? `${page.totalItems.toLocaleString()} direct items · largest first`
            : "Loading scanned directory…"}
        </p>
        {selected.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary/8 p-3">
            <p className="text-sm font-medium">
              {selected.size.toLocaleString()} items selected
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Map())}
              >
                Clear
              </Button>
              <Button
                size="sm"
                disabled={queueMutation.isPending}
                onClick={() => queueMutation.mutate()}
              >
                {queueMutation.isPending ? (
                  <LoaderCircleIcon className="animate-spin" />
                ) : (
                  <ListPlusIcon />
                )}
                Add to Cleanup Queue
              </Button>
            </div>
          </div>
        )}
        {queueMutation.isError && (
          <p className="mt-2 text-xs text-destructive">
            The selected items could not be verified against the saved scan.
          </p>
        )}
      </div>

      {directory.isPending ? (
        <p className="p-5 text-sm text-muted-foreground">
          Loading scanned items…
        </p>
      ) : directory.isError ? (
        <p className="p-5 text-sm text-destructive">
          {directory.error instanceof Error
            ? directory.error.message
            : "This scanned directory could not be loaded."}
        </p>
      ) : page?.items.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          This folder has no indexed files or subfolders.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {page?.items.map((item) => {
            const isDirectory = item.kind === "directory";
            return (
              <div
                key={item.id}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 sm:px-5"
              >
                <Checkbox
                  checked={selected.has(item.id)}
                  disabled={item.category === "system"}
                  aria-label={
                    item.category === "system"
                      ? `${item.name} is protected`
                      : `Select ${item.name}`
                  }
                  onCheckedChange={() => toggleItem(item)}
                />
                <button
                  type="button"
                  disabled={!isDirectory}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                  onClick={() => openDirectory(item.id, item.name)}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-primary">
                    {isDirectory ? (
                      <FolderIcon className="size-4" />
                    ) : (
                      <FileIcon className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {item.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatScanCategory(item.category)}
                    </span>
                  </span>
                </button>
                <span className="shrink-0 font-mono text-xs text-muted-foreground sm:text-sm">
                  {formatBytes(item.sizeBytes)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {page && page.totalItems > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
          <p className="text-xs text-muted-foreground">
            {page.offset + 1}–{pageEnd} of {page.totalItems.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page.offset === 0}
              onClick={() => setOffset(Math.max(0, page.offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pageEnd >= page.totalItems}
              onClick={() => setOffset(page.offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
