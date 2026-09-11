import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { BotIcon, ChevronDownIcon, FolderSearchIcon } from "lucide-react";
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
import type {
  AiStorageDataType,
  AiStorageItem,
} from "@/features/ai-storage/api/ai-storage-api";
import { aiStorageQuery } from "@/features/ai-storage/api/ai-storage-queries";
import { AiStorageEmptySection } from "@/features/ai-storage/components/sections/ai-storage-empty-section";
import { AddToCleanupQueueButton } from "@/features/cleanup/components/add-to-cleanup-queue-button";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";

const TYPE_LABELS: Record<AiStorageDataType, string> = {
  models: "Models",
  cache: "Cache",
  logs: "Logs",
  sessions: "Sessions",
  indexes: "Indexes",
  other: "Other",
};
export function AiStoragePage() {
  const { data: scan } = useQuery(currentScanQuery);
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="AI storage"
        title="Understand model and cache storage"
        description="Review local AI models, caches, logs, indexes, and sessions by source. Models and session data always require review."
      />
      {scan ? (
        <AiStorageBrowser scanVersion={scan.completedAtUnixSeconds} />
      ) : (
        <AiStorageEmptySection />
      )}
    </div>
  );
}
function AiStorageBrowser({ scanVersion }: { scanVersion: number }) {
  const navigate = useNavigate();
  const query = useQuery(aiStorageQuery(scanVersion));
  const [type, setType] = useState<AiStorageDataType | "all">("all");
  const [tool, setTool] = useState("all");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Map<number, AiStorageItem>>(
    new Map(),
  );
  const groups = useMemo(
    () =>
      (query.data?.groups ?? [])
        .filter((g) => tool === "all" || g.tool === tool)
        .map((g) => ({
          ...g,
          items: g.items.filter((i) => type === "all" || i.dataType === type),
        }))
        .filter((g) => g.items.length),
    [query.data, tool, type],
  );
  const selectedSize = [...selected.values()].reduce(
    (n, i) => n + i.sizeBytes,
    0,
  );
  const toggle = (item: AiStorageItem) => {
    if (item.safety === "protected") return;
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  };
  if (query.isPending)
    return <Message>Analyzing AI storage from the saved scan…</Message>;
  if (query.isError)
    return <Message>AI storage could not be analyzed.</Message>;
  if (!query.data?.itemCount) return <AiStorageEmptySection />;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="AI storage"
          value={formatBytes(query.data.totalSizeBytes)}
          detail={`${query.data.itemCount} known locations`}
        />
        <Metric
          label="Models"
          value={formatBytes(query.data.modelSizeBytes)}
          detail="Never automatically selected"
        />
        <Metric
          label="Likely safe cache/logs"
          value={formatBytes(query.data.safeCacheSizeBytes)}
          detail="Regeneratable or diagnostic data"
        />
        <Metric
          label="Selected"
          value={formatBytes(selectedSize)}
          detail={`${selected.size} locations · analysis only`}
        />
      </div>
      {selected.size > 0 && (
        <SectionCard className="sticky top-0 z-20 flex flex-col gap-3 border-primary/25 bg-card/95 p-4 shadow-md backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {selected.size.toLocaleString()} locations ·{" "}
              {formatBytes(selectedSize)}
            </p>
            <p className="text-xs text-muted-foreground">
              Models and sessions require deliberate review.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected(new Map())}>
              Clear
            </Button>
            <AddToCleanupQueueButton
              items={[...selected.values()]}
              source="aiStorage"
              scanVersion={scanVersion}
            />
          </div>
        </SectionCard>
      )}
      <SectionCard className="sticky top-0 z-20 grid gap-3 border-primary/20 bg-card/95 p-4 shadow-md backdrop-blur sm:grid-cols-2 sm:p-5">
        <Filter
          label="Tool"
          value={tool}
          onChange={setTool}
          options={[
            { value: "all", label: "All AI tools" },
            ...query.data.groups.map((g) => ({ value: g.tool, label: g.tool })),
          ]}
        />
        <Filter
          label="Data type"
          value={type}
          onChange={(v) => setType(v as AiStorageDataType | "all")}
          options={[
            { value: "all", label: "All data types" },
            ...Object.entries(TYPE_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
      </SectionCard>
      {groups.map((group) => {
        const expanded = open.has(group.tool);
        return (
          <SectionCard key={group.tool} className="overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
              aria-expanded={expanded}
              onClick={() =>
                setOpen((c) => {
                  const n = new Set(c);
                  if (n.has(group.tool)) n.delete(group.tool);
                  else n.add(group.tool);
                  return n;
                })
              }
            >
              <span className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <BotIcon />
                </span>
                <span>
                  <span className="block font-medium">{group.tool}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length} paths
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-3">
                <strong>
                  {formatBytes(
                    group.items.reduce((n, i) => n + i.sizeBytes, 0),
                  )}
                </strong>
                <ChevronDownIcon
                  className={`size-4 transition-transform ${expanded ? "" : "-rotate-90"}`}
                />
              </span>
            </button>
            {expanded && (
              <div className="divide-y divide-border border-t border-border">
                {group.items.slice(0, 100).map((item) => (
                  <div
                    key={item.id}
                    role="checkbox" aria-checked={selected.has(item.id)} tabIndex={item.safety === "protected" ? -1 : 0}
                    className="grid cursor-pointer gap-3 p-4 transition-colors hover:bg-muted/30 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5"
                    onClick={() => toggle(item)}
                    onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggle(item); } }}
                  >
                    <span onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(item.id)}
                      disabled={item.safety === "protected"}
                      aria-label={`Select ${item.path} for review`}
                      onCheckedChange={() => toggle(item)}
                    />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{TYPE_LABELS[item.dataType]}</strong>
                        <Safety safety={item.safety} />
                        <span className="text-sm">
                          {formatBytes(item.sizeBytes)}
                        </span>
                      </div>
                      <PathText className="mt-1 block">{item.path}</PathText>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.consequence}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void navigate({
                          to: "/explorer",
                          search: { directoryId: item.id },
                        });
                      }}
                    >
                      <FolderSearchIcon data-icon="inline-start" />
                      Inspect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
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
function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const shown = options.find((o) => o.value === value)?.label;
  return (
    <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Select value={value} onValueChange={(v) => v !== null && onChange(v)}>
        <SelectTrigger className="w-full">
          <SelectValue>{shown}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Safety({ safety }: { safety: AiStorageItem["safety"] }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] ${safety === "likelySafe" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
    >
      {safety === "likelySafe" ? "Likely safe" : "Review"}
    </span>
  );
}
function Message({ children }: { children: React.ReactNode }) {
  return (
    <SectionCard className="p-8 text-center text-sm text-muted-foreground">
      {children}
    </SectionCard>
  );
}
