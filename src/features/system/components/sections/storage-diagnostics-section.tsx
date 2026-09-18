import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ArchiveIcon,
  BoxIcon,
  DatabaseIcon,
  FileClockIcon,
  PackageIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import type { StorageDiagnostic } from "@/features/system/api/storage-diagnostics";
import { storageDiagnosticsQuery } from "@/features/system/api/storage-diagnostics-query";

const KIND_ICON: Record<string, typeof ArchiveIcon> = {
  logs: FileClockIcon,
  packageCache: PackageIcon,
  containers: BoxIcon,
  applications: ArchiveIcon,
  hiddenUsage: DatabaseIcon,
  snapshots: DatabaseIcon,
};

const SAFETY_LABEL = {
  regeneratable: "Regeneratable",
  review: "Review required",
  serviceAction: "Service action",
  unavailable: "Unavailable",
} as const;

export function StorageDiagnosticsSection() {
  const query = useQuery(storageDiagnosticsQuery);
  const scan = useQuery(currentScanQuery);
  const systemScan =
    scan.data?.targetLabel === "System storage" ? scan.data : null;
  const unattributed = systemScan?.capacity
    ? Math.max(
        0,
        systemScan.capacity.usedSpaceBytes - systemScan.totalSizeBytes,
      )
    : null;

  return (
    <SectionCard className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Hidden storage diagnostics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Linux services and storage that ordinary folder traversal cannot
            explain safely.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCwIcon
            data-icon="inline-start"
            className={query.isFetching ? "animate-spin" : ""}
          />
          Refresh
        </Button>
      </div>

      {unattributed !== null && (
        <div className="border-b border-border bg-amber-500/5 p-5">
          <div className="flex gap-3">
            <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold">
                {formatBytes(unattributed)} not attributed to indexed files
              </p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                This is the difference between filesystem-used space and the
                readable files in the latest system scan. Diagnostics below can
                explain parts of the gap, but their sizes may overlap and must
                not be added together.
              </p>
            </div>
          </div>
        </div>
      )}

      {query.isPending ? (
        <p className="p-5 text-sm text-muted-foreground">
          Reading Linux storage services…
        </p>
      ) : query.isError ? (
        <p className="p-5 text-sm text-destructive">
          Storage diagnostics could not be read: {String(query.error)}
        </p>
      ) : query.data.platform !== "linux" ? (
        <p className="p-5 text-sm text-muted-foreground">
          Platform-specific hidden-storage diagnostics are currently available
          on Linux. macOS and Windows adapters are still required.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {query.data.diagnostics.map((item) => (
            <DiagnosticRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function DiagnosticRow({ item }: { item: StorageDiagnostic }) {
  const Icon = KIND_ICON[item.kind] ?? DatabaseIcon;
  const safe = item.safety === "regeneratable";
  return (
    <div className={`p-5 ${item.available ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{item.title}</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${safe ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-200"}`}
            >
              {safe ? (
                <ShieldCheckIcon className="size-3" />
              ) : (
                <AlertTriangleIcon className="size-3" />
              )}
              {SAFETY_LABEL[item.safety]}
            </span>
          </div>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {item.detail}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            <span className="font-medium text-foreground">Safe method:</span>{" "}
            {item.cleanupMethod}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">
            {item.reclaimableSizeBytes !== null
              ? formatBytes(item.reclaimableSizeBytes)
              : item.detectedSizeBytes !== null
                ? formatBytes(item.detectedSizeBytes)
                : "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {item.reclaimableSizeBytes !== null
              ? "potentially reclaimable"
              : "detected storage"}
          </p>
        </div>
      </div>
    </div>
  );
}
