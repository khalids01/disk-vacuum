import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { navigationGroups } from "@/components/layout/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
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
  collapsed?: boolean;
}

export function SidebarContent({
  onNavigate,
  collapsed = false,
}: SidebarContentProps) {
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
    <>
      <SidebarGroup className="pb-2 group-data-[collapsible=icon]:hidden">
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
      </SidebarGroup>
      {navigationGroups.map((group) => (
        <SidebarGroup key={group.label} className="py-1">
          <SidebarGroupLabel className="h-7 text-[10px] font-bold tracking-[0.14em] uppercase">
            {group.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const active =
                  item.to === "/cleanup"
                    ? cleanupRoutes.has(pathname)
                    : pathname === item.to;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<Link to={item.to} onClick={onNavigate} />}
                      isActive={active}
                      tooltip={item.label}
                      size="lg"
                      className="text-muted-foreground [&_svg]:size-[18px] group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! data-active:text-sidebar-accent-foreground"
                      aria-label={collapsed ? item.label : undefined}
                    >
                      <item.icon />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
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
