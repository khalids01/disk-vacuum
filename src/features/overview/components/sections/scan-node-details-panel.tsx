import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, FolderOpenIcon, XIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { scanNodeDetailsQuery } from "@/features/overview/api/treemap-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { formatScanCategory } from "@/features/scan/lib/scan-category";

interface ScanNodeDetailsPanelProps {
  scanVersion: number;
  directoryId: number;
  nodeId: number;
  onClose: () => void;
  onOpenDirectory: () => void;
}

export function ScanNodeDetailsPanel({
  scanVersion,
  directoryId,
  nodeId,
  onClose,
  onOpenDirectory,
}: ScanNodeDetailsPanelProps) {
  const details = useQuery(
    scanNodeDetailsQuery(scanVersion, directoryId, nodeId),
  );
  const item = details.data;
  const explorerDirectoryId =
    item?.kind === "directory" ? item.id : item?.parentDirectoryId;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/35 lg:hidden"
        aria-label="Close selected item details"
        onClick={onClose}
      />
      <aside className="fixed inset-x-3 bottom-3 z-50 max-h-[70svh] overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-2xl lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:max-h-[calc(100svh-2rem)] lg:rounded-none lg:rounded-br-lg lg:border-y-0 lg:border-r-0 lg:p-5 lg:shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Selected item
            </p>
            <h3 className="mt-1 truncate text-base font-semibold">
              {item?.name ?? "Loading details…"}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close details"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>

        {details.isError ? (
          <p className="mt-4 text-sm text-destructive">
            {details.error instanceof Error
              ? details.error.message
              : "Item details could not be loaded."}
          </p>
        ) : item ? (
          <div className="mt-5 space-y-5">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Size</dt>
              <dd className="text-right font-mono">
                {formatBytes(item.sizeBytes)}
              </dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="text-right capitalize">{item.kind}</dd>
              <dt className="text-muted-foreground">Category</dt>
              <dd className="text-right">
                {formatScanCategory(item.category)}
              </dd>
              {item.kind === "directory" && (
                <>
                  <dt className="text-muted-foreground">Direct items</dt>
                  <dd className="text-right">
                    {item.childCount.toLocaleString()}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Modified</dt>
              <dd className="text-right">
                {item.modifiedAtUnixSeconds === null
                  ? "Unavailable"
                  : new Date(
                      item.modifiedAtUnixSeconds * 1_000,
                    ).toLocaleString()}
              </dd>
            </dl>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Scanned path
              </p>
              <p className="mt-1 break-all rounded-md bg-muted px-2.5 py-2 font-mono text-xs leading-5">
                {item.path}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {item.kind === "directory" && (
                <Button onClick={onOpenDirectory}>
                  <FolderOpenIcon data-icon="inline-start" />
                  Open in space map
                </Button>
              )}
              {explorerDirectoryId !== undefined && (
                <Link
                  to="/explorer"
                  search={{ directoryId: explorerDirectoryId }}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <ExternalLinkIcon data-icon="inline-start" />
                  Inspect in Explorer
                </Link>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Loading cached metadata…
          </p>
        )}
      </aside>
    </>
  );
}
