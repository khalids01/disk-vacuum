import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import {
  CheckIcon,
  FolderSearchIcon,
  LoaderCircleIcon,
  PlayIcon,
  SquareIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/core/page-header";
import { PathText } from "@/components/core/path-text";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  analyzeDuplicates,
  cancelDuplicateAnalysis,
  type DuplicateFile,
  type DuplicateProgress,
  type DuplicateReport,
  getDuplicateReport,
} from "@/features/duplicates/api/duplicates-api";
import { DuplicatesEmptySection } from "@/features/duplicates/components/sections/duplicates-empty-section";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { formatBytes } from "@/features/scan/lib/format-bytes";

const MIB = 1024 * 1024;
export function DuplicatesPage() {
  const { data: scan } = useQuery(currentScanQuery);
  const previous = useQuery({
    queryKey: ["duplicate-report", scan?.completedAtUnixSeconds],
    queryFn: getDuplicateReport,
    enabled: !!scan,
    staleTime: Infinity,
  });
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Duplicates"
        title="Compare duplicate files carefully"
        description="Confirm byte-identical files with staged hashing. Analysis runs only when requested and never removes files."
      />
      {scan ? (
        <DuplicateBrowser initial={previous.data ?? null} />
      ) : (
        <DuplicatesEmptySection />
      )}
    </div>
  );
}
function DuplicateBrowser({ initial }: { initial: DuplicateReport | null }) {
  const navigate = useNavigate();
  const [report, setReport] = useState(initial);
  const [progress, setProgress] = useState<DuplicateProgress | null>(null);
  const [selected, setSelected] = useState<Map<number, DuplicateFile>>(
    new Map(),
  );
  const job = useMutation({
    mutationFn: () => analyzeDuplicates(MIB),
    onSuccess: (r) => {
      setReport(r);
      setProgress(null);
    },
    onError: () => setProgress(null),
  });
  useEffect(() => {
    let off: (() => void) | undefined;
    void listen<DuplicateProgress>("duplicate-progress", (e) =>
      setProgress(e.payload),
    ).then((v) => (off = v));
    return () => off?.();
  }, []);
  const smartSelect = () => {
    const next = new Map<number, DuplicateFile>();
    for (const group of report?.groups ?? [])
      for (const file of group.files)
        if (!file.recommendedKeep) next.set(file.id, file);
    setSelected(next);
  };
  const selectedSize = [...selected.values()].reduce(
    (n, f) => n + f.sizeBytes,
    0,
  );
  const percent = progress?.total
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;
  return (
    <div className="space-y-4">
      <SectionCard className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Duplicate analysis</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Files smaller than 1 MiB are skipped to bound memory and I/O.
            </p>
          </div>
          <div className="flex gap-2">
            {job.isPending ? (
              <Button
                variant="outline"
                onClick={() => void cancelDuplicateAnalysis()}
              >
                <SquareIcon />
                Cancel
              </Button>
            ) : (
              <Button onClick={() => job.mutate()}>
                <PlayIcon />
                Analyze duplicates
              </Button>
            )}
            {report && (
              <Button variant="outline" onClick={smartSelect}>
                Select copies
              </Button>
            )}
          </div>
        </div>
        {job.isPending && (
          <div className="mt-4">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-2">
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                {progress?.stage === "fullHash"
                  ? "Confirming full file contents"
                  : "Grouping with partial hashes"}
              </span>
              <span>
                {progress?.processed ?? 0} / {progress?.total ?? 0}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </SectionCard>
      {report && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Confirmed groups"
            value={report.groupCount.toLocaleString()}
          />
          <Metric
            label="Reclaimable copies"
            value={formatBytes(report.reclaimableSizeBytes)}
          />
          <Metric
            label="Selected for review"
            value={formatBytes(selectedSize)}
          />
        </div>
      )}
      {!report ? (
        <DuplicatesEmptySection />
      ) : report.groups.length === 0 ? (
        <SectionCard className="p-8 text-center text-sm text-muted-foreground">
          No byte-identical files found above 1 MiB.
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {report.groups.map((group) => (
            <SectionCard key={group.id} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border p-4 sm:p-5">
                <div>
                  <p className="font-medium">
                    {group.files.length} identical files
                  </p>
                  <p className="text-xs text-muted-foreground">
                    One copy kept · {formatBytes(group.reclaimableSizeBytes)}{" "}
                    reclaimable
                  </p>
                </div>
                <strong>{formatBytes(group.fileSizeBytes)} each</strong>
              </div>
              <div className="divide-y divide-border">
                {group.files.map((file) => (
                  <div
                    key={file.id}
                    className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <Checkbox
                      checked={selected.has(file.id)}
                      disabled={file.recommendedKeep}
                      aria-label={
                        file.recommendedKeep
                          ? `Recommended keep ${file.path}`
                          : `Select copy ${file.path}`
                      }
                      onCheckedChange={() =>
                        setSelected((c) => {
                          const n = new Map(c);
                          if (n.has(file.id)) n.delete(file.id);
                          else n.set(file.id, file);
                          return n;
                        })
                      }
                    />
                    <div className="min-w-0">
                      <div className="flex gap-2">
                        <p className="font-medium">{file.name}</p>
                        {file.recommendedKeep && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 text-[11px] text-emerald-700">
                            <CheckIcon className="mr-1 inline size-3" />
                            Recommended keep
                          </span>
                        )}
                      </div>
                      <PathText className="mt-1 block">{file.path}</PathText>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Modified{" "}
                        {file.modifiedAtUnixSeconds === null
                          ? "date unavailable"
                          : new Intl.DateTimeFormat(undefined, {
                              dateStyle: "medium",
                            }).format(
                              new Date(file.modifiedAtUnixSeconds * 1000),
                            )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void navigate({
                          to: "/explorer",
                          search: { directoryId: file.parentDirectoryId },
                        })
                      }
                    >
                      <FolderSearchIcon />
                      Inspect
                    </Button>
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <SectionCard className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </SectionCard>
  );
}
