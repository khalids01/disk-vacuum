import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDownIcon, FolderSearchIcon, PackageXIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/core/page-header";
import { PathText } from "@/components/core/path-text";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { AppLeftoverItem } from "@/features/app-leftovers/api/app-leftovers-api";
import { appLeftoversQuery } from "@/features/app-leftovers/api/app-leftovers-queries";
import { AppLeftoversEmptySection } from "@/features/app-leftovers/components/sections/app-leftovers-empty-section";
import { CleanupReviewDialog } from "@/features/cleanup/components/cleanup-review-dialog";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";

export function AppLeftoversPage() {
  const { data: scan } = useQuery(currentScanQuery);
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="App leftovers"
        title="Find orphaned application data"
        description="Compare recognized application-data locations with installed apps. Absence is evidence, not certainty, so every candidate remains review-first."
      />
      {scan ? (
        <LeftoversBrowser scanVersion={scan.completedAtUnixSeconds} />
      ) : (
        <AppLeftoversEmptySection />
      )}
    </div>
  );
}

function LeftoversBrowser({ scanVersion }: { scanVersion: number }) {
  const navigate = useNavigate();
  const query = useQuery(appLeftoversQuery(scanVersion));
  const [selected, setSelected] = useState<Map<number, AppLeftoverItem>>(
    new Map(),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const selectedSize = useMemo(
    () => [...selected.values()].reduce((sum, item) => sum + item.sizeBytes, 0),
    [selected],
  );

  if (query.isPending)
    return <Message>Comparing installed apps with the saved scan…</Message>;
  if (query.isError)
    return <Message>Application leftovers could not be analyzed.</Message>;
  if (!query.data.itemCount) return <AppLeftoversEmptySection />;

  const toggle = (item: AppLeftoverItem) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Candidates"
          value={query.data.itemCount.toLocaleString()}
          detail="Recognized app-data locations"
        />
        <Metric
          label="Candidate storage"
          value={formatBytes(query.data.totalSizeBytes)}
          detail="Not automatically considered junk"
        />
        <Metric
          label="High confidence"
          value={query.data.highConfidenceCount.toLocaleString()}
          detail="Still requires explicit selection"
        />
      </div>

      <SectionCard className="border-amber-500/25 bg-amber-500/5 p-4 text-sm text-muted-foreground">
        Installed-app inventories can miss portable, command-line, or manually
        installed apps. Inspect paths and confirm an app is gone before
        selecting its data.
      </SectionCard>

      {selected.size > 0 && (
        <SectionCard className="sticky top-0 z-20 flex flex-col gap-3 border-primary/25 bg-card/95 p-4 shadow-md backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {selected.size.toLocaleString()} locations ·{" "}
              {formatBytes(selectedSize)}
            </p>
            <p className="text-xs text-muted-foreground">
              Nothing was auto-selected.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected(new Map())}>
              Clear
            </Button>
            <CleanupReviewDialog
              items={[...selected.values()]}
              title="Review application leftovers"
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

      {query.data.groups.map((group) => {
        const open = expanded.has(group.appName);
        return (
          <SectionCard key={group.appName} className="overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
              aria-expanded={open}
              onClick={() =>
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(group.appName)) next.delete(group.appName);
                  else next.add(group.appName);
                  return next;
                })
              }
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <PackageXIcon />
                </span>
                <span className="min-w-0">
                  <strong className="block truncate">{group.appName}</strong>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length} candidate locations
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <strong>{formatBytes(group.totalSizeBytes)}</strong>
                <ChevronDownIcon
                  className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`}
                />
              </span>
            </button>
            {open && (
              <div className="divide-y divide-border border-t border-border">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5"
                  >
                    <Checkbox
                      checked={selected.has(item.id)}
                      aria-label={`Select ${item.path} for review`}
                      onCheckedChange={() => toggle(item)}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Confidence value={item.confidence} />
                        <span className="text-sm font-semibold">
                          {formatBytes(item.sizeBytes)}
                        </span>
                      </div>
                      <PathText className="mt-1 block">{item.path}</PathText>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.evidence}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void navigate({
                          to: "/explorer",
                          search: { directoryId: item.id },
                        })
                      }
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

function Confidence({ value }: { value: AppLeftoverItem["confidence"] }) {
  const labels = {
    high: "High confidence",
    likely: "Likely",
    review: "Review",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] ${value === "high" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
    >
      {labels[value]}
    </span>
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
function Message({ children }: { children: React.ReactNode }) {
  return (
    <SectionCard className="p-8 text-center text-sm text-muted-foreground">
      {children}
    </SectionCard>
  );
}
