import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { navigationGroups } from "@/components/layout/navigation";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { ScanFolderButton } from "@/features/scan/components/scan-folder-button";
import { ScanHomeButton } from "@/features/scan/components/scan-home-button";
import { ScanSystemButton } from "@/features/scan/components/scan-system-button";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import type { ScanTargetPreference } from "@/features/settings/api/settings-api";
import { settingsQuery } from "@/features/settings/api/settings-queries";
import { useScanStore } from "@/stores/scan-store";

interface SidebarContentProps {
  onNavigate?: () => void;
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const cleanupRoutes = new Set([
    "/cleanup",
    "/cleanup-queue",
    "/large-files",
    "/duplicates",
    "/developer-cleanup",
    "/ai-storage",
    "/app-leftovers",
  ]);
  const { data: currentScan } = useQuery(currentScanQuery);
  const { data: settings } = useQuery(settingsQuery);
  const scanStatus = useScanStore((state) => state.status);
  const scanProgress = useScanStore((state) => state.progress);
  const isScanActive = scanStatus === "scanning" || scanStatus === "cancelling";
  const progressLabel = `${(scanProgress?.entriesVisited ?? 0).toLocaleString()} items inspected`;
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5">
      <div className="rounded-2xl border border-border bg-card/75 p-3.5 shadow-[0_14px_32px_-26px_rgb(0_0_0_/_0.8)]">
        <p className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
          Scan target
        </p>
        {currentScan ? (
          <>
            <p className="mt-1 text-sm font-medium">
              {currentScan.targetLabel}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isScanActive
                ? progressLabel
                : `${formatBytes(currentScan.totalSizeBytes)} indexed`}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm font-medium">
            {isScanActive ? progressLabel : "No scan selected"}
          </p>
        )}
        <PreferredScanControls
          preference={settings?.defaultScanTarget ?? "system"}
        />
      </div>
      {navigationGroups.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.to === "/cleanup"
                  ? cleanupRoutes.has(pathname)
                  : pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={
                    "flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground " +
                    (active
                      ? "bg-accent font-medium text-accent-foreground shadow-sm"
                      : "text-muted-foreground")
                  }
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PreferredScanControls({
  preference,
}: {
  preference: ScanTargetPreference;
}) {
  if (preference === "home")
    return (
      <>
        <ScanHomeButton className="mt-3 w-full" size="sm" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ScanSystemButton variant="outline" size="sm">
            System
          </ScanSystemButton>
          <ScanFolderButton variant="outline" size="sm">
            Folder
          </ScanFolderButton>
        </div>
      </>
    );
  if (preference === "folder")
    return (
      <>
        <ScanFolderButton className="mt-3 w-full" size="sm" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ScanSystemButton variant="outline" size="sm">
            System
          </ScanSystemButton>
          <ScanHomeButton variant="outline" size="sm">
            Home
          </ScanHomeButton>
        </div>
      </>
    );
  return (
    <>
      <ScanSystemButton className="mt-3 w-full" size="sm" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <ScanHomeButton className="w-full" variant="outline" size="sm">
          Home
        </ScanHomeButton>
        <ScanFolderButton variant="outline" size="sm">
          Folder
        </ScanFolderButton>
      </div>
    </>
  );
}
