import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  BotIcon,
  BoxesIcon,
  BracesIcon,
  CopyIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { PageHeader } from "@/components/core/page-header";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { aiStorageQuery } from "@/features/ai-storage/api/ai-storage-queries";
import { CleanupEmptySection } from "@/features/cleanup/components/sections/cleanup-empty-section";
import { developerCleanupQuery } from "@/features/developer-cleanup/api/developer-cleanup-queries";
import { getDuplicateReport } from "@/features/duplicates/api/duplicates-api";
import { largeFilesQuery } from "@/features/large-files/api/large-files-queries";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { settingsQuery } from "@/features/settings/api/settings-queries";

const MEBIBYTE = 1024 * 1024;

export function CleanupPage() {
  const navigate = useNavigate();
  const scan = useQuery(currentScanQuery);
  const settings = useQuery(settingsQuery);
  const largeFileMinimumBytes =
    (settings.data?.largeFileThresholdMb ?? 100) * MEBIBYTE;
  const scanVersion = scan.data?.completedAtUnixSeconds ?? 0;
  const enabled = scan.data !== null && scan.data !== undefined;
  const duplicates = useQuery({
    queryKey: ["duplicate-report", scanVersion],
    queryFn: getDuplicateReport,
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const developer = useQuery({
    ...developerCleanupQuery(scanVersion),
    enabled,
  });
  const ai = useQuery({ ...aiStorageQuery(scanVersion), enabled });
  const largeFiles = useQuery({
    ...largeFilesQuery(scanVersion, {
      minimumSizeBytes: largeFileMinimumBytes,
      category: null,
      safety: "likelySafe",
      extension: null,
      modifiedBeforeUnixSeconds: null,
      sort: "sizeDescending",
      offset: 0,
      limit: 1,
    }),
    enabled,
  });

  if (scan.isPending) return <HubMessage>Loading the saved scan…</HubMessage>;
  if (!scan.data) {
    return (
      <div className="space-y-5">
        <HubHeader />
        <CleanupEmptySection />
      </div>
    );
  }

  const developerSafeItems =
    developer.data?.groups
      .flatMap((group) => group.items)
      .filter((item) => item.safety === "likelySafe") ?? [];
  const developerSafeSize = developerSafeItems.reduce(
    (total, item) => total + item.sizeBytes,
    0,
  );
  const developerSafeCount = developerSafeItems.length;
  const anyPending =
    duplicates.isPending ||
    developer.isPending ||
    ai.isPending ||
    largeFiles.isPending;
  const anyError =
    duplicates.isError || developer.isError || ai.isError || largeFiles.isError;

  return (
    <div className="space-y-5">
      <HubHeader />

      <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-4 text-sm">
        <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="font-medium">Cleanup remains review-first</p>
          <p className="mt-1 text-muted-foreground">
            Open an analyzer, select candidates, and validate them before moving
            anything to your system Trash.
          </p>
        </div>
      </div>

      {anyPending && <HubMessage>Collecting cleanup summaries…</HubMessage>}
      {anyError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          One or more cleanup summaries could not be loaded. You can still open
          each analyzer directly.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <CleanupSourceCard
          icon={CopyIcon}
          title="Duplicate files"
          description="Exact-content copies confirmed through hashing. Keep one copy from each group."
          count={duplicates.data?.duplicateFileCount ?? 0}
          countLabel="duplicate copies"
          sizeBytes={duplicates.data?.reclaimableSizeBytes ?? 0}
          sizeLabel="confirmed reclaimable"
          status={duplicates.data ? "Exact matches" : "Run analysis"}
          onOpen={() => void navigate({ to: "/duplicates" })}
        />
        <CleanupSourceCard
          icon={BracesIcon}
          title="Developer cleanup"
          description="Regeneratable dependencies, build output, compiler targets, and project caches."
          count={developerSafeCount}
          countLabel="likely-safe locations"
          sizeBytes={developerSafeSize}
          sizeLabel="likely-safe storage"
          status="Regeneratable"
          onOpen={() => void navigate({ to: "/developer-cleanup" })}
        />
        <CleanupSourceCard
          icon={BotIcon}
          title="AI storage"
          description="Review local model caches, logs, sessions, and indexes by tool and consequence."
          count={ai.data?.itemCount ?? 0}
          countLabel="detected locations"
          sizeBytes={ai.data?.safeCacheSizeBytes ?? 0}
          sizeLabel="cache and log candidates"
          status="Consequence-aware"
          onOpen={() => void navigate({ to: "/ai-storage" })}
        />
        <CleanupSourceCard
          icon={BoxesIcon}
          title="Large files"
          description={`Likely-safe files at least ${formatBytes(largeFileMinimumBytes)}, with filters for deeper review.`}
          count={largeFiles.data?.totalCount ?? 0}
          countLabel="likely-safe files"
          sizeBytes={largeFiles.data?.totalSizeBytes ?? 0}
          sizeLabel="matching storage"
          status="Filtered view"
          onOpen={() => void navigate({ to: "/large-files" })}
        />
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        Sizes are intentionally not combined: a large file can also belong to
        another cleanup source, so adding these figures could overstate
        reclaimable storage.
      </p>
    </div>
  );
}

function HubHeader() {
  return (
    <PageHeader
      eyebrow="Cleanup hub"
      title="Choose what to reclaim"
      description="Compare cleanup sources from the saved scan, then open the right analyzer for selection and final review."
    />
  );
}

function CleanupSourceCard({
  icon: Icon,
  title,
  description,
  count,
  countLabel,
  sizeBytes,
  sizeLabel,
  status,
  onOpen,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  count: number;
  countLabel: string;
  sizeBytes: number;
  sizeLabel: string;
  status: string;
  onOpen: () => void;
}) {
  return (
    <SectionCard className="flex min-h-64 flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {status}
        </span>
      </div>
      <div className="mt-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric value={count.toLocaleString()} label={countLabel} />
        <Metric value={formatBytes(sizeBytes)} label={sizeLabel} />
      </div>
      <Button className="mt-auto w-full" variant="outline" onClick={onOpen}>
        Open {title}
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </SectionCard>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="mb-5 rounded-lg bg-muted/40 p-3">
      <p className="font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-4 text-muted-foreground">{label}</p>
    </div>
  );
}

function HubMessage({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
