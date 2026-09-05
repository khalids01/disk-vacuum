import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { navigationGroups } from "@/components/layout/navigation";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { ScanFolderButton } from "@/features/scan/components/scan-folder-button";
import { ScanHomeButton } from "@/features/scan/components/scan-home-button";
import { ScanSystemButton } from "@/features/scan/components/scan-system-button";
import { formatBytes } from "@/features/scan/lib/format-bytes";
import { useScanStore } from "@/stores/scan-store";

interface SidebarContentProps {
  onNavigate?: () => void;
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const { data: currentScan } = useQuery(currentScanQuery);
  const scanStatus = useScanStore((state) => state.status);
  const scanProgress = useScanStore((state) => state.progress);
  const isScanActive = scanStatus === "scanning" || scanStatus === "cancelling";
  const progressLabel = `${(scanProgress?.entriesVisited ?? 0).toLocaleString()} items inspected`;

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-medium text-muted-foreground">Scan target</p>
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
        <ScanSystemButton className="mt-3 w-full" size="sm" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ScanHomeButton className="w-full" variant="outline" size="sm">
            Home
          </ScanHomeButton>
          <ScanFolderButton variant="outline" size="sm">
            Folder
          </ScanFolderButton>
        </div>
      </div>

      {navigationGroups.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                activeProps={{ className: "bg-accent text-accent-foreground" }}
                className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
