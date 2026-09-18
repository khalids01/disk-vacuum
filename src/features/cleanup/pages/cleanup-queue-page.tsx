import {
  AlertTriangleIcon,
  ListChecksIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/core/page-header";
import { PathText } from "@/components/core/path-text";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
const TYPE_LABEL: Record<string, string> = {
  nodeModules: "Node modules",
  buildOutput: "Build output",
  rustTarget: "Rust targets",
  pythonVirtualEnvironment: "Python environments",
  pythonCache: "Python caches",
  packageCache: "Package caches",
  temporaryBuildOutput: "Temporary build output",
  models: "AI models",
  cache: "Caches",
  logs: "Logs",
  sessions: "Sessions",
  indexes: "Indexes",
  largeFiles: "Large files",
  duplicates: "Duplicates",
  explorer: "Explorer items",
  appLeftovers: "App leftovers",
  aiStorage: "AI storage",
  developer: "Developer files",
};
const SAFETY_LABEL = {
  regeneratable: "Regeneratable",
  review: "Review required",
} as const;

export function CleanupQueuePage() {
  const [sourceFilter, setSourceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const queued = useCleanupQueueStore((state) => state.items);
  const remove = useCleanupQueueStore((state) => state.remove);
  const removeIds = useCleanupQueueStore((state) => state.removeIds);
  const clear = useCleanupQueueStore((state) => state.clear);
  const items = useMemo(() => [...queued.values()], [queued]);
  const typeOptions = useMemo(
    () => [...new Set(items.map((item) => item.cleanupType ?? item.source))],
    [items],
  );
  const visibleItems = items.filter(
    (item) =>
      (sourceFilter === "all" || item.source === sourceFilter) &&
      (typeFilter === "all" ||
        (item.cleanupType ?? item.source) === typeFilter),
  );
  const regularItems = items.filter((item) => item.source !== "duplicates");
  const permanentItems = regularItems;
  const duplicateItems = items.filter(
    (item) => item.source === "duplicates",
  ) as unknown as DuplicateFile[];
  const size = items.reduce((total, item) => total + item.sizeBytes, 0);
  const reviewCount = items.filter((item) => item.safety === "review").length;
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
          <SectionCard className="sticky top-0 z-30 space-y-3 border-primary/20 bg-card/95 p-4 shadow-md backdrop-blur">
            <div className="grid gap-3 sm:grid-cols-2">
              <QueueFilter
                label="Source"
                value={sourceFilter}
                onValueChange={setSourceFilter}
                options={[
                  { value: "all", label: "All sources" },
                  ...Object.entries(SOURCE_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
              <QueueFilter
                label="Type"
                value={typeFilter}
                onValueChange={setTypeFilter}
                options={[
                  { value: "all", label: "All types" },
                  ...typeOptions.map((value) => ({
                    value,
                    label: TYPE_LABEL[value] ?? value,
                  })),
                ]}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">
                  {items.length.toLocaleString()} items · up to{" "}
                  {formatBytes(size)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Overlapping child paths are automatically removed from the
                  queue. {reviewCount.toLocaleString()} item
                  {reviewCount === 1 ? " requires" : "s require"} deliberate
                  review.
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
            </div>
          </SectionCard>
          <SectionCard className="divide-y divide-border overflow-hidden">
            {visibleItems.map((item) => (
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
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${item.safety === "regeneratable" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-200"}`}
                    >
                      {item.safety === "regeneratable" ? (
                        <ShieldCheckIcon className="size-3" />
                      ) : (
                        <AlertTriangleIcon className="size-3" />
                      )}
                      {SAFETY_LABEL[item.safety]}
                    </span>
                  </div>
                  <PathText className="mt-1 block">{item.path}</PathText>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Consequence:
                    </span>{" "}
                    {item.consequence}
                  </p>
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

function QueueFilter({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Select
        value={value}
        onValueChange={(next) => next && onValueChange(next)}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            {options.find((option) => option.value === value)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
