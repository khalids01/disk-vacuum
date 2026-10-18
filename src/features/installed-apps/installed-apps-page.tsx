import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  EraserIcon,
  FolderSearchIcon,
  PackageIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/core/page-header";
import { PathText } from "@/components/core/path-text";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  clearAppCache,
  getInstalledApps,
  type InstalledApp,
  uninstallApp,
} from "@/features/installed-apps/installed-apps-api";
import { formatBytes } from "@/features/scan/lib/format-bytes";

type Action = "cache" | "uninstall";

export function InstalledAppsPage() {
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const query = useQuery({
    queryKey: ["installed-apps"],
    queryFn: getInstalledApps,
    staleTime: 60_000,
  });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "size">("size");
  const [review, setReview] = useState<{
    app: InstalledApp;
    action: Action;
  } | null>(null);
  const action = useMutation({
    mutationFn: ({ app, action }: { app: InstalledApp; action: Action }) =>
      action === "cache" ? clearAppCache(app.key) : uninstallApp(app.key),
    onSuccess: async () => {
      setReview(null);
      await queryClient.invalidateQueries({
        queryKey: ["installed-apps"],
      });
    },
  });
  const locate = useMutation({
    mutationFn: async (app: InstalledApp) => {
      if (!app.installationPath)
        throw new Error("App location is unavailable.");
      await revealItemInDir(app.installationPath);
    },
  });
  const apps = useMemo(() => {
    const rows = (query.data ?? []).filter((app) =>
      `${app.name} ${app.source}`.toLowerCase().includes(search.toLowerCase()),
    );
    return rows.sort((a, b) =>
      sort === "size"
        ? (b.installedBytes ?? -1) - (a.installedBytes ?? -1) ||
          a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
  }, [query.data, search, sort]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Applications"
        title="Installed apps"
        description="See installed app storage and identifiable cache. Storage estimates may omit shared files or personal app data."
      />
      <SectionCard className="p-4 text-sm text-muted-foreground">
        System components and apps with uncertain removal safety are hidden on
        Windows and Linux. Cache is shown only when DiskVacuum can match a
        dedicated app cache folder. Clearing it moves that folder to Trash or
        Recycle Bin. Uninstall uses the native uninstall flow. macOS app bundles
        move to Trash; uninstallers may offer to remove personal data.
      </SectionCard>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Search installed apps"
          placeholder="Search apps or source…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        <Button
          variant={sort === "size" ? "secondary" : "outline"}
          onClick={() => setSort("size")}
        >
          Largest
        </Button>
        <Button
          variant={sort === "name" ? "secondary" : "outline"}
          onClick={() => setSort("name")}
        >
          Name
        </Button>
        <Button
          variant="outline"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCwIcon /> Refresh
        </Button>
      </div>
      {query.isPending && (
        <SectionCard className="p-6 text-sm text-muted-foreground">
          Reading installed apps and their cache sizes…
        </SectionCard>
      )}
      {query.isError && (
        <SectionCard className="p-6 text-sm text-destructive">
          Could not read installed apps: {String(query.error)}
        </SectionCard>
      )}
      {query.isSuccess && (
        <p className="text-sm text-muted-foreground">
          {apps.length.toLocaleString()} apps shown
        </p>
      )}
      {query.isSuccess && apps.length === 0 && (
        <SectionCard className="p-6 text-sm text-muted-foreground">
          No matching apps found.
        </SectionCard>
      )}
      {locate.isError && (
        <p role="alert" className="text-sm text-destructive">
          Could not locate app: {String(locate.error)}
        </p>
      )}
      <TooltipProvider delay={150}>
        <div className="space-y-2">
          {apps.map((app) => (
            <SectionCard
              key={app.key}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <PackageIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <strong className="block truncate">{app.name}</strong>
                  <span className="text-xs text-muted-foreground">
                    {app.source}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-sm tabular-nums sm:min-w-40 sm:text-right">
                <div className="flex items-baseline gap-2 sm:justify-end">
                  <span className="text-muted-foreground">Storage</span>
                  <strong>
                    {app.installedBytes == null
                      ? "Unavailable"
                      : formatBytes(app.installedBytes)}
                  </strong>
                </div>
                <div className="flex items-baseline gap-2 sm:justify-end">
                  <span className="text-muted-foreground">Cache</span>
                  <span>
                    {app.cacheBytes == null
                      ? "Unavailable"
                      : formatBytes(app.cacheBytes)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 sm:ml-3">
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={`Locate ${app.name}`}
                      disabled={
                        !app.installationPath ||
                        action.isPending ||
                        locate.isPending
                      }
                      onClick={() => locate.mutate(app)}
                    >
                      <FolderSearchIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {app.installationPath
                      ? "Locate app"
                      : "App location unavailable"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={`Clear cache for ${app.name}`}
                      disabled={!app.cachePath || action.isPending}
                      onClick={() => {
                        action.reset();
                        setReview({ app, action: "cache" });
                      }}
                    >
                      <EraserIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {app.cachePath
                      ? "Clear cache"
                      : "No identifiable app cache"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <Button
                      size="icon"
                      variant="destructive"
                      aria-label={`Uninstall ${app.name}`}
                      disabled={!app.uninstallAvailable || action.isPending}
                      onClick={() => {
                        action.reset();
                        setReview({ app, action: "uninstall" });
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {app.uninstallAvailable
                      ? "Uninstall app"
                      : "Uninstall unavailable"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </SectionCard>
          ))}
        </div>
      </TooltipProvider>
      <Dialog
        modal
        disablePointerDismissal
        open={review !== null}
        onOpenChange={(open) => {
          if (!open && !action.isPending) setReview(null);
        }}
      >
        <DialogContent
          initialFocus={cancelRef}
          showCloseButton={!action.isPending}
        >
          <DialogHeader>
            <DialogTitle className="break-words pr-6">
              {review?.action === "cache"
                ? "Clear app cache?"
                : `Uninstall ${review?.app.name ?? "app"}?`}
            </DialogTitle>
            <DialogDescription>
              {review?.action === "cache"
                ? "The cache folder will move to Trash or Recycle Bin. The app may recreate it."
                : review?.app.key.startsWith("mac:")
                  ? "This will move the application to Trash. Quit the app before continuing. Personal app data will remain."
                  : "This will start the app’s uninstaller. You may be asked for administrator permission, and the uninstaller may offer to remove app data."}
            </DialogDescription>
          </DialogHeader>
          {review && (
            <div className="space-y-2 text-sm">
              <strong>{review.app.name}</strong>
              <p className="text-muted-foreground">{review.app.source}</p>
              {review.action === "cache" && (
                <>
                  <PathText>{review.app.cachePath ?? ""}</PathText>
                  <p>
                    {review.app.cacheBytes == null
                      ? "Size unavailable"
                      : formatBytes(review.app.cacheBytes)}
                  </p>
                </>
              )}
            </div>
          )}
          {action.isError && (
            <p role="alert" className="text-sm text-destructive">
              {String(action.error)}
            </p>
          )}
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  ref={cancelRef}
                  variant="outline"
                  disabled={action.isPending}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              disabled={!review || action.isPending}
              onClick={() => {
                if (review && !action.isPending) action.mutate(review);
              }}
            >
              <Trash2Icon />
              {action.isPending
                ? "Working…"
                : review?.action === "cache"
                  ? "Clear cache"
                  : "Uninstall app"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
