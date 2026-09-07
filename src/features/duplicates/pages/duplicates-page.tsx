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
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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
const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});
const MINIMUM_SIZE_OPTIONS = [
  { value: 1, label: "1 MiB · Thorough" },
  { value: 10, label: "10 MiB · Recommended" },
  { value: 100, label: "100 MiB · Fastest" },
] as const;
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
  const [minimumSizeMiB, setMinimumSizeMiB] = useState(10);
  const selectedIds = useRef(new Set<number>());
  const [selectedSize, setSelectedSize] = useState(0);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const job = useMutation({
    mutationFn: () => analyzeDuplicates(minimumSizeMiB * MIB),
    onMutate: () => {
      setProgress({ stage: "sizing", processed: 0, total: 0 });
      selectedIds.current.clear();
      setSelectedSize(0);
      setSelectionVersion((version) => version + 1);
    },
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
    const next = new Set<number>();
    let size = 0;
    for (const group of report?.groups ?? [])
      for (const file of group.files)
        if (!file.recommendedKeep) {
          next.add(file.id);
          size += file.sizeBytes;
        }
    selectedIds.current = next;
    setSelectedSize(size);
    setSelectionVersion((version) => version + 1);
  };
  const toggleFile = useCallback((file: DuplicateFile) => {
    if (file.recommendedKeep) return;
    if (selectedIds.current.delete(file.id)) {
      startTransition(() => setSelectedSize((size) => size - file.sizeBytes));
    } else {
      selectedIds.current.add(file.id);
      startTransition(() => setSelectedSize((size) => size + file.sizeBytes));
    }
  }, []);
  const inspectDirectory = useCallback(
    (directoryId: number) => {
      void navigate({
        to: "/explorer",
        search: { directoryId },
      });
    },
    [navigate],
  );
  const percent = progress?.total
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;
  const progressLabel =
    progress?.stage === "sizing"
      ? "Finding files with matching sizes"
      : progress?.stage === "fullHash"
        ? "Confirming matches byte for byte"
        : "Checking small samples from possible duplicates";
  const progressHelp =
    progress?.stage === "sizing"
      ? "Reading the saved scan index. File contents are not opened yet."
      : progress?.stage === "fullHash"
        ? "Only files whose size and samples matched reach this final check."
        : "Reading only the beginning and end of each candidate file.";
  return (
    <div className="space-y-4">
      <SectionCard className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Duplicate analysis</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Smaller files find more duplicates but require more disk reads.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={minimumSizeMiB}
              onValueChange={(value) =>
                value !== null && setMinimumSizeMiB(value)
              }
              disabled={job.isPending}
            >
              <SelectTrigger
                className="w-44 max-w-full"
                aria-label="Minimum duplicate file size"
              >
                <SelectValue>
                  {
                    MINIMUM_SIZE_OPTIONS.find(
                      (option) => option.value === minimumSizeMiB,
                    )?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                className="w-max min-w-52 max-w-[calc(100vw-2rem)]"
              >
                {MINIMUM_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                {progressLabel}
              </span>
              <span>
                {progress?.total
                  ? `${percent}% · ${progress.processed.toLocaleString()} / ${progress.total.toLocaleString()}`
                  : "Preparing candidates…"}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              {progress?.total ? (
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              ) : (
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{progressHelp}</p>
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
          No byte-identical files found above {minimumSizeMiB} MiB.
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
                  <DuplicateFileRow
                    key={file.id}
                    file={file}
                    initiallyChecked={selectedIds.current.has(file.id)}
                    selectionVersion={selectionVersion}
                    onToggle={toggleFile}
                    onInspect={inspectDirectory}
                  />
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
const DuplicateFileRow = memo(function DuplicateFileRow({
  file,
  initiallyChecked,
  selectionVersion,
  onToggle,
  onInspect,
}: {
  file: DuplicateFile;
  initiallyChecked: boolean;
  selectionVersion: number;
  onToggle: (file: DuplicateFile) => void;
  onInspect: (directoryId: number) => void;
}) {
  const [checked, setChecked] = useState(initiallyChecked);
  useEffect(() => {
    void selectionVersion;
    setChecked(initiallyChecked);
  }, [initiallyChecked, selectionVersion]);
  const toggle = () => {
    if (file.recommendedKeep) return;
    setChecked((value) => !value);
    onToggle(file);
  };
  return (
    /* biome-ignore lint/a11y/useSemanticElements: the selectable row contains its native checkbox and Inspect button. */
    <div
      className="grid cursor-pointer gap-3 p-4 hover:bg-muted/40 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={file.recommendedKeep}
      tabIndex={file.recommendedKeep ? -1 : 0}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          toggle();
        }
      }}
    >
      <Checkbox
        checked={checked}
        disabled={file.recommendedKeep}
        aria-label={
          file.recommendedKeep
            ? `Recommended keep ${file.path}`
            : `Select copy ${file.path}`
        }
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={toggle}
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
            : DATE_FORMATTER.format(
                new Date(file.modifiedAtUnixSeconds * 1000),
              )}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          onInspect(file.parentDirectoryId);
        }}
      >
        <FolderSearchIcon />
        Inspect
      </Button>
    </div>
  );
});

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
