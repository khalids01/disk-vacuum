import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckIcon,
  ChevronDownIcon,
  ClipboardIcon,
  FolderSearchIcon,
  RefreshCwIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/core/page-header";
import { PathText } from "@/components/core/path-text";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddToCleanupQueueButton } from "@/features/cleanup/components/add-to-cleanup-queue-button";
import type {
  DeveloperArtifactKind,
  DeveloperCleanupItem,
} from "@/features/developer-cleanup/api/developer-cleanup-api";
import { developerCleanupQuery } from "@/features/developer-cleanup/api/developer-cleanup-queries";
import { DeveloperCleanupEmptySection } from "@/features/developer-cleanup/components/sections/developer-cleanup-empty-section";
import type { LargeFileSafety } from "@/features/large-files/api/large-files-api";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";

const KIND_META: Record<
  DeveloperArtifactKind,
  { label: string; description: string }
> = {
  nodeModules: {
    label: "Node dependencies",
    description: "Installed dependencies inside node_modules directories.",
  },
  buildOutput: {
    label: "Build output",
    description:
      "Generated project builds, bundles, coverage, and framework output.",
  },
  rustTarget: {
    label: "Rust targets",
    description: "Cargo compiler output verified by a neighboring Cargo.toml.",
  },
  pythonVirtualEnvironment: {
    label: "Python environments",
    description:
      "Project-local Python environments that require dependency reinstalling.",
  },
  pythonCache: {
    label: "Python caches",
    description: "Regeneratable Python bytecode caches.",
  },
  packageCache: {
    label: "Package caches",
    description: "Downloaded npm, Yarn, pnpm, and Bun package data.",
  },
  temporaryBuildOutput: {
    label: "Tool and test caches",
    description:
      "Generated state from test runners, linters, and type checkers.",
  },
};

export function DeveloperCleanupPage() {
  const { data: currentScan } = useQuery(currentScanQuery);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Developer cleanup"
        title="Inspect development storage"
        description="Find regeneratable dependencies, compiler output, environments, and tool caches in the saved scan. Nothing is removed here."
      />
      {currentScan ? (
        <DeveloperCleanupBrowser
          key={currentScan.completedAtUnixSeconds}
          scanVersion={currentScan.completedAtUnixSeconds}
        />
      ) : (
        <DeveloperCleanupEmptySection />
      )}
    </div>
  );
}

function DeveloperCleanupBrowser({ scanVersion }: { scanVersion: number }) {
  const navigate = useNavigate();
  const query = useQuery(developerCleanupQuery(scanVersion));
  const [kind, setKind] = useState<DeveloperArtifactKind | "all">("all");
  const [safety, setSafety] = useState<LargeFileSafety | "all">("all");
  const [collapsed, setCollapsed] = useState<Set<DeveloperArtifactKind>>(
    new Set(Object.keys(KIND_META) as DeveloperArtifactKind[]),
  );
  const [visibleLimits, setVisibleLimits] = useState<
    Partial<Record<DeveloperArtifactKind, number>>
  >({});
  const [selected, setSelected] = useState<Map<number, DeveloperCleanupItem>>(
    new Map(),
  );
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const groups = useMemo(
    () =>
      (query.data?.groups ?? [])
        .filter((group) => kind === "all" || group.kind === kind)
        .map((group) => {
          const items = group.items.filter(
            (item) => safety === "all" || item.safety === safety,
          );
          return {
            ...group,
            items,
            visibleItemCount: items.length,
            visibleSizeBytes: items.reduce(
              (sum, item) => sum + item.sizeBytes,
              0,
            ),
          };
        })
        .filter((group) => group.items.length > 0),
    [kind, query.data, safety],
  );
  const visibleItems = groups.flatMap((group) => group.items);
  const visibleSize = visibleItems.reduce(
    (sum, item) => sum + item.sizeBytes,
    0,
  );
  const selectedSize = [...selected.values()].reduce(
    (sum, item) => sum + item.sizeBytes,
    0,
  );
  const quickCleanItems = (query.data?.groups ?? [])
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        item.safety === "likelySafe" &&
        item.kind !== "packageCache" &&
        item.kind !== "pythonVirtualEnvironment",
    );

  function toggleItem(item: DeveloperCleanupItem) {
    if (item.safety === "protected") return;
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }

  function toggleGroup(items: DeveloperCleanupItem[]) {
    const selectable = items.filter((item) => item.safety !== "protected");
    const allSelected = selectable.every((item) => selected.has(item.id));
    setSelected((current) => {
      const next = new Map(current);
      for (const item of selectable) {
        if (allSelected) next.delete(item.id);
        else next.set(item.id, item);
      }
      return next;
    });
  }

  function toggleCollapsed(groupKind: DeveloperArtifactKind) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(groupKind)) next.delete(groupKind);
      else next.add(groupKind);
      return next;
    });
  }

  async function copyPath(item: DeveloperCleanupItem) {
    await navigator.clipboard.writeText(item.path);
    setCopiedId(item.id);
    window.setTimeout(
      () => setCopiedId((current) => (current === item.id ? null : current)),
      1_500,
    );
  }

  if (query.isPending) {
    return (
      <Message>Analyzing developer artifacts from the saved index…</Message>
    );
  }
  if (query.isError) {
    return (
      <Message destructive>
        {query.error instanceof Error
          ? query.error.message
          : "Developer storage could not be analyzed."}
      </Message>
    );
  }
  if (!query.data || query.data.totalCount === 0) {
    return <DeveloperCleanupEmptySection />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Detected artifacts"
          value={formatBytes(query.data.totalSizeBytes)}
          detail={`${query.data.totalCount.toLocaleString()} regeneratable locations`}
        />
        <Metric
          label="Visible with filters"
          value={formatBytes(visibleSize)}
          detail={`${visibleItems.length.toLocaleString()} displayed locations`}
        />
        <Metric
          label="Selected for review"
          value={formatBytes(selectedSize)}
          detail={`${selected.size.toLocaleString()} locations · no deletion enabled`}
        />
      </div>

      <SectionCard className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <Filter label="Artifact type">
              <FilterSelect
                value={kind}
                onValueChange={(value) =>
                  setKind(value as DeveloperArtifactKind | "all")
                }
                options={[
                  { value: "all", label: "All artifact types" },
                  ...Object.entries(KIND_META).map(([value, meta]) => ({
                    value,
                    label: meta.label,
                  })),
                ]}
              />
            </Filter>
            <Filter label="Safety">
              <FilterSelect
                value={safety}
                onValueChange={(value) =>
                  setSafety(value as LargeFileSafety | "all")
                }
                options={[
                  { value: "all", label: "All safety levels" },
                  { value: "likelySafe", label: "Likely safe to regenerate" },
                  { value: "review", label: "Needs review" },
                  { value: "protected", label: "Protected" },
                ]}
              />
            </Filter>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickCleanItems.length > 0 && (
              <AddToCleanupQueueButton
                items={quickCleanItems}
                source="developer"
                scanVersion={scanVersion}
                label={`Add ${quickCleanItems.length.toLocaleString()} safe items`}
                requireRegeneratable
              />
            )}
            <Button variant="outline" onClick={() => void query.refetch()}>
              <RefreshCwIcon data-icon="inline-start" />
              Re-analyze index
            </Button>
          </div>
        </div>
        {query.data.displayedCount < query.data.totalCount && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing the 300 largest results per category to keep the page
            responsive.
          </p>
        )}
      </SectionCard>

      {selected.size > 0 && (
        <SectionCard className="sticky top-0 z-20 flex flex-col gap-3 border-primary/25 bg-card/95 p-4 shadow-md backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {selected.size.toLocaleString()} locations selected ·{" "}
              {formatBytes(selectedSize)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Review every regeneration consequence before cleanup is enabled.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected(new Map())}>
              Clear selection
            </Button>
            <AddToCleanupQueueButton
              items={[...selected.values()]}
              source="developer"
              scanVersion={scanVersion}
              onAdded={() => setSelected(new Map())}
            />
          </div>
        </SectionCard>
      )}

      {groups.length === 0 ? (
        <Message>No developer artifacts match these filters.</Message>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const meta = KIND_META[group.kind];
            const isCollapsed = collapsed.has(group.kind);
            const selectable = group.items.filter(
              (item) => item.safety !== "protected",
            );
            const displayedItems = group.items.slice(
              0,
              visibleLimits[group.kind] ?? 40,
            );
            const allSelected =
              selectable.length > 0 &&
              selectable.every((item) => selected.has(item.id));
            return (
              <SectionCard key={group.kind} className="overflow-hidden">
                <div className="flex items-start gap-3 border-b border-border p-4 sm:p-5">
                  <Checkbox
                    className="mt-1"
                    checked={allSelected}
                    aria-label={`Select visible ${meta.label}`}
                    onCheckedChange={() => toggleGroup(group.items)}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleCollapsed(group.kind)}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{meta.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {meta.description}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-right">
                        <span className="block font-semibold">
                          {formatBytes(group.visibleSizeBytes)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {group.visibleItemCount.toLocaleString()} shown ·{" "}
                          {group.itemCount.toLocaleString()} found
                        </span>
                      </span>
                      <ChevronDownIcon
                        className={`size-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                      />
                    </span>
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="divide-y divide-border">
                    {displayedItems.map((item) => (
                      <ArtifactRow
                        key={item.id}
                        item={item}
                        selected={selected.has(item.id)}
                        copied={copiedId === item.id}
                        onToggle={() => toggleItem(item)}
                        onCopy={() => void copyPath(item)}
                        onInspect={() =>
                          void navigate({
                            to: "/explorer",
                            search: { directoryId: item.id },
                          })
                        }
                      />
                    ))}
                    {displayedItems.length < group.items.length && (
                      <div className="flex justify-center p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setVisibleLimits((current) => ({
                              ...current,
                              [group.kind]: displayedItems.length + 40,
                            }))
                          }
                        >
                          Show 40 more
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArtifactRow({
  item,
  selected,
  copied,
  onToggle,
  onCopy,
  onInspect,
}: {
  item: DeveloperCleanupItem;
  selected: boolean;
  copied: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onInspect: () => void;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={selected}
      tabIndex={item.safety === "protected" ? -1 : 0}
      className="grid cursor-pointer gap-3 p-4 transition-colors hover:bg-muted/30 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5"
      onClick={onToggle}
      onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onToggle(); } }}
    >
      <span onClick={(event) => event.stopPropagation()}>
      <Checkbox
        checked={selected}
        disabled={item.safety === "protected"}
        aria-label={`Select ${item.path} for review`}
        onCheckedChange={onToggle}
      />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{item.projectName}</p>
          <SafetyBadge safety={item.safety} />
          <span className="text-sm font-semibold">
            {formatBytes(item.sizeBytes)}
          </span>
        </div>
        <PathText className="mt-1 block">{item.path}</PathText>
        <p className="mt-1 text-xs text-muted-foreground">
          Modified {formatModified(item.modifiedAtUnixSeconds)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {item.explanation} {item.regeneration}
        </p>
      </div>
      <div className="flex gap-2 sm:justify-end" onClick={(event) => event.stopPropagation()}>
        <Button variant="outline" size="sm" onClick={onInspect}>
          <FolderSearchIcon data-icon="inline-start" />
          Inspect
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copy path"
          onClick={onCopy}
        >
          {copied ? <CheckIcon /> : <ClipboardIcon />}
        </Button>
      </div>
    </div>
  );
}

function formatModified(value: number | null) {
  if (value === null) return "date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value * 1_000));
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <SectionCard className="p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </SectionCard>
  );
}

function SafetyBadge({ safety }: { safety: LargeFileSafety }) {
  const meta: Record<LargeFileSafety, { label: string; className: string }> = {
    likelySafe: {
      label: "Likely safe",
      className:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    review: {
      label: "Review",
      className:
        "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
    protected: {
      label: "Protected",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    },
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta[safety].className}`}
    >
      {meta[safety].label}
    </span>
  );
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </div>
  );
}

function FilterSelect({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label;
  return (
    <Select
      value={value}
      onValueChange={(next) => next !== null && onValueChange(next)}
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

function Message({
  children,
  destructive = false,
}: {
  children: ReactNode;
  destructive?: boolean;
}) {
  return (
    <SectionCard
      className={`p-8 text-center text-sm ${destructive ? "text-destructive" : "text-muted-foreground"}`}
    >
      {children}
    </SectionCard>
  );
}
