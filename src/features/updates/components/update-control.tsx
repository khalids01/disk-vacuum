import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUpdateStore } from "@/features/updates/stores/update-store";

export function UpdateControl({ compact = false }: { compact?: boolean }) {
  const state = useUpdateStore();
  if (
    compact &&
    state.status !== "available" &&
    state.status !== "downloading" &&
    state.status !== "installed"
  )
    return null;
  const percent =
    state.totalBytes && state.totalBytes > 0
      ? Math.min(
          100,
          Math.round((state.downloadedBytes / state.totalBytes) * 100),
        )
      : null;
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant={state.status === "available" ? "default" : "outline"}
            size={compact ? "sm" : "default"}
          />
        }
      >
        {state.status === "available" ? (
          <DownloadIcon data-icon="inline-start" />
        ) : (
          <RefreshCwIcon
            data-icon="inline-start"
            className={state.status === "checking" ? "animate-spin" : ""}
          />
        )}
        {state.status === "available"
          ? `Update ${state.version}`
          : "Check for updates"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {state.status === "available"
              ? `DiskVacuum ${state.version} is available`
              : state.status === "downloading"
                ? "Installing update"
                : "Application updates"}
          </DialogTitle>
          <DialogDescription>
            Current version {state.currentVersion ?? "unknown"}
          </DialogDescription>
        </DialogHeader>
        <UpdateBody
          status={state.status}
          notes={state.notes}
          error={state.error}
          percent={percent}
          downloaded={state.downloadedBytes}
          total={state.totalBytes}
        />
        <DialogFooter>
          {(state.status === "idle" ||
            state.status === "upToDate" ||
            state.status === "error") && (
            <Button
              variant="outline"
              onClick={() => void state.checkForUpdate(true)}
            >
              Check again
            </Button>
          )}
          {state.status === "available" && (
            <Button onClick={() => void state.installAndRestart()}>
              <DownloadIcon data-icon="inline-start" />
              Update and restart
            </Button>
          )}
          {state.status === "downloading" && (
            <Button disabled>Installing…</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function UpdateBody({
  status,
  notes,
  error,
  percent,
  downloaded,
  total,
}: {
  status: string;
  notes: string | null;
  error: string | null;
  percent: number | null;
  downloaded: number;
  total: number | null;
}) {
  if (status === "checking")
    return (
      <p className="text-sm text-muted-foreground">
        Checking the signed release channel…
      </p>
    );
  if (status === "upToDate")
    return (
      <p className="text-sm text-muted-foreground">
        You already have the latest version.
      </p>
    );
  if (status === "error")
    return (
      <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
        {error ?? "The update check failed."}
      </p>
    );
  if (status === "available")
    return (
      <div className="space-y-3">
        <p className="text-sm">
          The update will be downloaded, signature-verified, installed, and the
          app will restart.
        </p>
        {notes && (
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            {notes}
          </p>
        )}
      </div>
    );
  if (status === "downloading" || status === "installed")
    return (
      <div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${percent ?? 15}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {percent === null
            ? `${formatBytes(downloaded)} downloaded`
            : `${percent}% · ${formatBytes(downloaded)} of ${formatBytes(total ?? 0)}`}
        </p>
      </div>
    );
  return (
    <p className="text-sm text-muted-foreground">
      DiskVacuum checks the signed GitHub release channel automatically after
      launch.
    </p>
  );
}
function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
