import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { PathText } from "@/components/core/path-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  type CleanupResult,
  type CleanupTarget,
  previewCleanupTargets,
  trashCleanupTargets,
} from "@/features/cleanup/api/cleanup-api";
import { formatBytes } from "@/features/scan/lib/format-bytes";

export function CleanupReviewDialog({
  items,
  title,
  onComplete,
}: {
  items: CleanupTarget[];
  title: string;
  onComplete?: (result: CleanupResult) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const preview = useMutation({
    mutationFn: () => previewCleanupTargets(items),
  });
  const cleanup = useMutation({
    mutationFn: () => trashCleanupTargets(items),
    onSuccess: (value) => {
      void queryClient.invalidateQueries({ queryKey: ["current-scan"] });
      setResult(value);
      onComplete?.(value);
    },
  });
  const rejected = preview.data?.rejected ?? [];
  const ready = preview.data?.ready ?? [];
  const error = preview.error ?? cleanup.error;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setResult(null);
          cleanup.reset();
          preview.mutate();
        }
      }}
    >
      <DialogTrigger render={<Button />}>Move all to Trash…</DialogTrigger>
      <DialogContent className="flex max-h-[min(88vh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border p-5 pr-12">
          <DialogTitle>{result ? "Cleanup complete" : title}</DialogTitle>
          <DialogDescription>
            {result
              ? "Validated locations were processed using your system Trash."
              : "DiskVacuum validates every location again before enabling Trash."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {result ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Moved"
                  value={result.movedIds.length.toLocaleString()}
                />
                <Metric
                  label="Moved to Trash"
                  value={formatBytes(result.processedSizeBytes)}
                />
                <Metric
                  label="Failed"
                  value={result.failed.length.toLocaleString()}
                />
              </div>
              {result.failed.map((issue) => (
                <Issue key={issue.id} path={issue.path} reason={issue.reason} />
              ))}
              <p className="text-sm text-muted-foreground">
                Files in Trash still use disk space. Empty the system Trash to actually reclaim it; storage totals refresh automatically.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Validated"
                  value={preview.data ? ready.length.toLocaleString() : "—"}
                />
                <Metric
                  label="Selected size"
                  value={formatBytes(
                    preview.data?.reclaimableSizeBytes ??
                      items.reduce((sum, item) => sum + item.sizeBytes, 0),
                  )}
                />
                <Metric label="Destination" value="System Trash" />
              <Notice>Moving items to Trash is reversible, but does not free disk space until you empty Trash.</Notice>
              </div>
              {preview.isPending && (
                <Notice loading>
                  Validating scan scope, metadata, symlinks, and protected
                  paths…
                </Notice>
              )}
              {error && (
                <Issue
                  path="Cleanup could not continue"
                  reason={String(error)}
                />
              )}
              {rejected.length > 0 && (
                <Notice>
                  {rejected.length.toLocaleString()} locations failed
                  validation. Remove them from the selection before continuing.
                </Notice>
              )}
              <div className="mt-5 space-y-2">
                {items.map((item) => {
                  const issue = rejected.find((value) => value.id === item.id);
                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-3 ${issue ? "border-destructive/30 bg-destructive/10" : "border-border bg-muted/20"}`}
                    >
                      <div className="flex justify-between gap-3">
                        <strong className="truncate">{item.name}</strong>
                        <span className="shrink-0 text-sm">
                          {formatBytes(item.sizeBytes)}
                        </span>
                      </div>
                      <PathText className="mt-1 block">{item.path}</PathText>
                      {issue && (
                        <p className="mt-1 text-xs text-destructive">
                          {issue.reason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="m-0">
          <DialogClose render={<Button variant="outline" />}>
            {result ? "Done" : "Cancel"}
          </DialogClose>
          {!result && (
            <Button
              variant="destructive"
              disabled={
                !preview.data ||
                rejected.length > 0 ||
                ready.length === 0 ||
                cleanup.isPending
              }
              onClick={() => cleanup.mutate()}
            >
              {cleanup.isPending ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <Trash2Icon />
              )}
              {cleanup.isPending
                ? "Moving to Trash…"
                : `Move ${ready.length.toLocaleString()} to Trash`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
function Notice({
  children,
  loading = false,
}: {
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
      {loading ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : (
        <AlertTriangleIcon className="size-4" />
      )}
      <p>{children}</p>
    </div>
  );
}
function Issue({ path, reason }: { path: string; reason: string }) {
  return (
    <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
      <PathText>{path}</PathText>
      <p className="mt-1 text-destructive">{reason}</p>
    </div>
  );
}
