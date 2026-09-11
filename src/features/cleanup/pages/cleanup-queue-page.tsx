import { ListChecksIcon, Trash2Icon } from "lucide-react";
import { PageHeader } from "@/components/core/page-header";
import { PathText } from "@/components/core/path-text";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { CleanupReviewDialog } from "@/features/cleanup/components/cleanup-review-dialog";
import { PermanentDeleteDialog } from "@/features/cleanup/components/permanent-delete-dialog";
import type { DuplicateFile } from "@/features/duplicates/api/duplicates-api";
import { DuplicateReviewDialog } from "@/features/duplicates/pages/duplicates-page";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { useCleanupQueueStore } from "@/stores/cleanup-queue-store";

const SOURCE_LABEL = {
  explorer: "Explorer",
  largeFiles: "Large Files",
  developer: "Developer Cleanup",
  aiStorage: "AI Storage",
  appLeftovers: "App Leftovers",
  duplicates: "Duplicates",
} as const;
export function CleanupQueuePage() {
  const queued = useCleanupQueueStore((state) => state.items);
  const remove = useCleanupQueueStore((state) => state.remove);
  const removeIds = useCleanupQueueStore((state) => state.removeIds);
  const clear = useCleanupQueueStore((state) => state.clear);
  const items = [...queued.values()];
  const regularItems = items.filter((item) => item.source !== "duplicates");
  const permanentItems = regularItems;
  const duplicateItems = items.filter(
    (item) => item.source === "duplicates",
  ) as unknown as DuplicateFile[];
  const size = items.reduce((total, item) => total + item.sizeBytes, 0);
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cleanup Queue"
        title="Review everything before removal"
        description="Items from Explorer and cleanup tools stay here while you compare their paths and consequences. DiskVacuum validates them again before removal."
      />
      {!items.length ? (
        <SectionCard className="grid min-h-64 place-items-center p-8 text-center">
          <div>
            <ListChecksIcon className="mx-auto size-9 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">Your Cleanup Queue is empty</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add items from Explorer or a cleanup analyzer.
            </p>
          </div>
        </SectionCard>
      ) : (
        <>
          <SectionCard className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">
                {items.length.toLocaleString()} items · up to{" "}
                {formatBytes(size)}
              </p>
              <p className="text-xs text-muted-foreground">
                Overlapping child paths are automatically removed from the
                queue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={clear}>
                Clear queue
              </Button>
              {regularItems.length > 0 && (
                <CleanupReviewDialog
                  items={regularItems}
                  title="Move all selected items to Trash?"
                  onComplete={(result) => removeIds(result.movedIds)}
                />
              )}
              {permanentItems.length > 0 && (
                <PermanentDeleteDialog
                  items={permanentItems}
                  onComplete={(result) => removeIds(result.movedIds)}
                />
              )}
              {duplicateItems.length > 0 && (
                <DuplicateReviewDialog
                  files={duplicateItems}
                  groupCount={
                    new Set(
                      items
                        .filter((item) => item.source === "duplicates")
                        .map((item) => item.duplicateGroupId),
                    ).size
                  }
                  totalSize={duplicateItems.reduce(
                    (sum, item) => sum + item.sizeBytes,
                    0,
                  )}
                  onComplete={async (result) => {
                    removeIds(result.movedIds);
                    return result;
                  }}
                />
              )}
            </div>
          </SectionCard>
          <SectionCard className="divide-y divide-border overflow-hidden">
            {items.map((item) => (
              <div
                key={item.path}
                className="flex items-start gap-3 p-4 sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate">{item.name}</strong>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {SOURCE_LABEL[item.source]}
                    </span>
                  </div>
                  <PathText className="mt-1 block">{item.path}</PathText>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatBytes(item.sizeBytes)}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${item.name} from Cleanup Queue`}
                  onClick={() => remove(item.path)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </SectionCard>
        </>
      )}
    </div>
  );
}
