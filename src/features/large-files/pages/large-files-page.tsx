import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  FileIcon,
  FolderSearchIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/core/page-header";
import { PathText } from "@/components/core/path-text";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CleanupReviewDialog } from "@/features/cleanup/components/cleanup-review-dialog";
import type {
  LargeFileItem,
  LargeFileSafety,
  LargeFileSort,
} from "@/features/large-files/api/large-files-api";
import { largeFilesQuery } from "@/features/large-files/api/large-files-queries";
import { LargeFilesEmptySection } from "@/features/large-files/components/sections/large-files-empty-section";
import type { ScanCategory } from "@/features/scan/api/scan-api";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { formatScanCategory } from "@/features/scan/lib/scan-category";

const PAGE_SIZE = 100;
const MEBIBYTE = 1024 * 1024;
const CATEGORY_OPTIONS: ScanCategory[] = [
  "applications",
  "documents",
  "downloads",
  "images",
  "video",
  "audio",
  "archives",
  "developer",
  "ai",
  "caches",
  "system",
  "other",
];

export function LargeFilesPage() {
  const { data: currentScan } = useQuery(currentScanQuery);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Large files"
        title="Find the biggest files first"
        description="Review large files from the completed scan. Large does not mean safe to remove."
      />
      {currentScan ? (
        <LargeFilesBrowser
          key={currentScan.completedAtUnixSeconds}
          scanVersion={currentScan.completedAtUnixSeconds}
        />
      ) : (
        <LargeFilesEmptySection />
      )}
    </div>
  );
}

function LargeFilesBrowser({ scanVersion }: { scanVersion: number }) {
  const navigate = useNavigate();
  const [thresholdMb, setThresholdMb] = useState(100);
  const [category, setCategory] = useState<ScanCategory | "all">("all");
  const [extension, setExtension] = useState("");
  const [safety, setSafety] = useState<LargeFileSafety | "all">("all");
  const [debouncedExtension, setDebouncedExtension] = useState("");
  const [ageDays, setAgeDays] = useState(0);
  const [sort, setSort] = useState<LargeFileSort>("sizeDescending");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Map<number, LargeFileItem>>(
    new Map(),
  );
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedExtension(extension.trim()),
      350,
    );
    return () => window.clearTimeout(timeout);
  }, [extension]);

  const modifiedBeforeUnixSeconds = useMemo(
    () =>
      ageDays > 0 ? Math.floor(Date.now() / 1_000) - ageDays * 86_400 : null,
    [ageDays],
  );
  const query = useQuery(
    largeFilesQuery(scanVersion, {
      minimumSizeBytes: thresholdMb * MEBIBYTE,
      category: category === "all" ? null : category,
      safety: safety === "all" ? null : safety,
      extension: debouncedExtension || null,
      modifiedBeforeUnixSeconds,
      sort,
      offset,
      limit: PAGE_SIZE,
    }),
  );
  const page = query.data;
  const pageEnd = page ? page.offset + page.items.length : 0;
  const selectedSize = [...selected.values()].reduce(
    (sum, item) => sum + item.sizeBytes,
    0,
  );

  function resetPage() {
    setOffset(0);
  }

  function toggleItem(item: LargeFileItem) {
    if (item.safety === "protected") return;
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }

  async function copyPath(item: LargeFileItem) {
    await navigator.clipboard.writeText(item.path);
    setCopiedId(item.id);
    window.setTimeout(
      () => setCopiedId((current) => (current === item.id ? null : current)),
      1_500,
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <SectionCard className="p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Filtered large files
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {page ? formatBytes(page.totalSizeBytes) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {page
              ? `${page.totalCount.toLocaleString()} files represented`
              : "Calculating…"}
          </p>
        </SectionCard>
        <SectionCard className="p-4 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Selected for review
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {formatBytes(selectedSize)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selected.size.toLocaleString()} files · no files are removed here
          </p>
        </SectionCard>
      </div>

      {selected.size > 0 && (
        <SectionCard className="sticky top-0 z-20 flex flex-col gap-3 border-primary/25 bg-card/95 p-4 shadow-md backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {selected.size.toLocaleString()} files ·{" "}
              {formatBytes(selectedSize)}
            </p>
            <p className="text-xs text-muted-foreground">
              Review is required before moving anything to Trash.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected(new Map())}>
              Clear
            </Button>
            <CleanupReviewDialog
              items={[...selected.values()]}
              title="Review large files"
              onComplete={(result) =>
                setSelected(
                  (current) =>
                    new Map(
                      [...current].filter(
                        ([id]) => !result.movedIds.includes(id),
                      ),
                    ),
                )
              }
            />
          </div>
        </SectionCard>
      )}

      <SectionCard className="overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-3 lg:p-5 xl:grid-cols-6">
          <Filter label="Minimum size">
            <FilterSelect
              value={String(thresholdMb)}
              onValueChange={(value) => {
                setThresholdMb(Number(value));
                resetPage();
              }}
              options={[
                { value: "100", label: "100 MB" },
                { value: "500", label: "500 MB" },
                { value: "1024", label: "1 GB" },
                { value: "5120", label: "5 GB" },
              ]}
            />
          </Filter>
          <Filter label="Type / extension">
            <Input
              value={extension}
              onChange={(event) => {
                setExtension(event.target.value);
                resetPage();
              }}
              placeholder="e.g. iso, zip"
            />
          </Filter>
          <Filter label="Category">
            <FilterSelect
              value={category}
              onValueChange={(value) => {
                setCategory(value as ScanCategory | "all");
                resetPage();
              }}
              options={[
                { value: "all", label: "All categories" },
                ...CATEGORY_OPTIONS.map((value) => ({
                  value,
                  label: formatScanCategory(value),
                })),
              ]}
            />
          </Filter>
          <Filter label="Safety">
            <FilterSelect
              value={safety}
              onValueChange={(value) => {
                setSafety(value as LargeFileSafety | "all");
                resetPage();
              }}
              options={[
                { value: "all", label: "All safety levels" },
                { value: "likelySafe", label: "Likely safe to remove" },
                { value: "review", label: "Needs review" },
                { value: "protected", label: "Protected / critical" },
              ]}
            />
          </Filter>
          <Filter label="Age">
            <FilterSelect
              value={String(ageDays)}
              onValueChange={(value) => {
                setAgeDays(Number(value));
                resetPage();
              }}
              options={[
                { value: "0", label: "Any age" },
                { value: "30", label: "Older than 30 days" },
                { value: "180", label: "Older than 6 months" },
                { value: "365", label: "Older than 1 year" },
              ]}
            />
          </Filter>
          <Filter label="Sort">
            <FilterSelect
              value={sort}
              onValueChange={(value) => {
                setSort(value as LargeFileSort);
                resetPage();
              }}
              options={[
                { value: "sizeDescending", label: "Largest first" },
                { value: "modifiedNewest", label: "Newest modified" },
                { value: "modifiedOldest", label: "Oldest modified" },
                { value: "nameAscending", label: "Name A–Z" },
              ]}
            />
          </Filter>
        </div>

        {query.isPending ? (
          <Message>Loading large files from the saved scan…</Message>
        ) : query.isError ? (
          <Message destructive>
            {query.error instanceof Error
              ? query.error.message
              : "Large files could not be loaded."}
          </Message>
        ) : page?.items.length === 0 ? (
          <Message>
            No files match these filters. Try a lower threshold or broader
            filters.
          </Message>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full table-fixed text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-3 py-3">File</th>
                    <th className="w-28 px-3 py-3">Size</th>
                    <th className="w-32 px-3 py-3">Modified</th>
                    <th className="w-28 px-3 py-3">Status</th>
                    <th className="w-24 px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {page?.items.map((item) => (
                    <LargeFileTableRow
                      key={item.id}
                      item={item}
                      selected={selected.has(item.id)}
                      copied={copiedId === item.id}
                      onToggle={toggleItem}
                      onCopy={copyPath}
                      onInspect={() =>
                        void navigate({
                          to: "/explorer",
                          search: { directoryId: item.parentDirectoryId },
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border lg:hidden">
              {page?.items.map((item) => (
                <LargeFileCard
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  copied={copiedId === item.id}
                  onToggle={toggleItem}
                  onCopy={copyPath}
                  onInspect={() =>
                    void navigate({
                      to: "/explorer",
                      search: { directoryId: item.parentDirectoryId },
                    })
                  }
                />
              ))}
            </div>
          </>
        )}

        {page && page.totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
            <p className="text-xs text-muted-foreground">
              {page.offset + 1}–{pageEnd} of {page.totalCount.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page.offset === 0 || query.isFetching}
                onClick={() => setOffset(Math.max(0, page.offset - PAGE_SIZE))}
              >
                <ChevronLeftIcon data-icon="inline-start" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pageEnd >= page.totalCount || query.isFetching}
                onClick={() => setOffset(page.offset + PAGE_SIZE)}
              >
                Next
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

interface FilterSelectOption {
  value: string;
  label: string;
}

function FilterSelect({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: FilterSelectOption[];
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label;
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onValueChange(nextValue);
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Filter({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

interface RowProps {
  item: LargeFileItem;
  selected: boolean;
  copied: boolean;
  onToggle: (item: LargeFileItem) => void;
  onCopy: (item: LargeFileItem) => void;
  onInspect: () => void;
}

function LargeFileTableRow(props: RowProps) {
  const { item } = props;
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <Selection
          item={item}
          selected={props.selected}
          onToggle={props.onToggle}
        />
      </td>
      <td className="min-w-0 px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted">
            <FileIcon className="size-4 text-muted-foreground" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{item.name}</span>
            <PathText className="block" title={item.parentPath}>
              {item.parentPath}
            </PathText>
            <span className="text-[11px] text-muted-foreground">
              {formatScanCategory(item.category)}
              {item.extension ? ` · .${item.extension}` : ""}
            </span>
          </span>
        </div>
      </td>
      <td className="px-3 py-3 font-mono text-xs">
        {formatBytes(item.sizeBytes)}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {formatModified(item.modifiedAtUnixSeconds)}
      </td>
      <td className="px-3 py-3">
        <SafetyBadge safety={item.safety} />
      </td>
      <td className="px-3 py-3">
        <RowActions {...props} />
      </td>
    </tr>
  );
}

function LargeFileCard(props: RowProps) {
  const { item } = props;
  return (
    <article className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <Selection
          item={item}
          selected={props.selected}
          onToggle={props.onToggle}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.name}</p>
          <PathText className="mt-1 block" title={item.parentPath}>
            {item.parentPath}
          </PathText>
        </div>
        <p className="shrink-0 font-mono text-xs font-medium">
          {formatBytes(item.sizeBytes)}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 pl-8">
        <div className="flex items-center gap-2">
          <SafetyBadge safety={item.safety} />
          <span className="text-xs text-muted-foreground">
            {formatModified(item.modifiedAtUnixSeconds)}
          </span>
        </div>
        <RowActions {...props} />
      </div>
    </article>
  );
}

function Selection({
  item,
  selected,
  onToggle,
}: Pick<RowProps, "item" | "selected" | "onToggle">) {
  const protectedItem = item.safety === "protected";
  return (
    <Checkbox
      checked={selected}
      disabled={protectedItem}
      aria-label={
        protectedItem
          ? `${item.name} is protected`
          : `Select ${item.name} for review`
      }
      onCheckedChange={() => onToggle(item)}
    />
  );
}

function RowActions({ item, copied, onCopy, onInspect }: RowProps) {
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Copy path for ${item.name}`}
        title="Copy path"
        onClick={() => void onCopy(item)}
      >
        {copied ? <CheckIcon /> : <ClipboardIcon />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Inspect ${item.name} in Explorer`}
        title="Inspect in Explorer"
        onClick={onInspect}
      >
        <FolderSearchIcon />
      </Button>
    </div>
  );
}

function SafetyBadge({ safety }: { safety: LargeFileSafety }) {
  const labels: Record<LargeFileSafety, string> = {
    likelySafe: "Likely safe",
    review: "Review",
    protected: "Protected",
  };
  const colors: Record<LargeFileSafety, string> = {
    likelySafe: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    review: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    protected: "bg-red-500/10 text-red-700 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${colors[safety]}`}
    >
      {labels[safety]}
    </span>
  );
}

function Message({
  children,
  destructive = false,
}: {
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <div
      className={`grid min-h-52 place-items-center p-6 text-center text-sm ${destructive ? "text-destructive" : "text-muted-foreground"}`}
    >
      {children}
    </div>
  );
}

function formatModified(value: number | null) {
  if (value === null) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value * 1_000),
  );
}
