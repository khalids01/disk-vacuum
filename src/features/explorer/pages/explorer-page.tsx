import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/core/page-header";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { scanDirectoryQuery } from "@/features/explorer/api/explorer-queries";
import { ExplorerEmptySection } from "@/features/explorer/components/sections/explorer-empty-section";
import type { ScanSummary } from "@/features/scan/api/scan-api";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { formatScanCategory } from "@/features/scan/lib/scan-category";

const PAGE_SIZE = 100;

interface BreadcrumbItem {
  id: number;
  name: string;
}

export function ExplorerPage() {
  const { data: currentScan } = useQuery(currentScanQuery);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Explorer"
        title="Browse storage by folder"
        description="Follow your scanned folders from the root down without rescanning the filesystem."
      />
      {currentScan ? (
        <ScanExplorer
          key={currentScan.completedAtUnixSeconds}
          summary={currentScan}
        />
      ) : (
        <ExplorerEmptySection />
      )}
    </div>
  );
}

function ScanExplorer({ summary }: { summary: ScanSummary }) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: summary.rootDirectoryId, name: summary.targetLabel },
  ]);
  const [offset, setOffset] = useState(0);
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
              <button
                key={item.id}
                type="button"
                disabled={!isDirectory}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left enabled:hover:bg-muted/60 disabled:cursor-default sm:px-5"
                onClick={() => openDirectory(item.id, item.name)}
              >
                <span className="flex min-w-0 items-center gap-3">
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
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground sm:text-sm">
                  {formatBytes(item.sizeBytes)}
                </span>
              </button>
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
