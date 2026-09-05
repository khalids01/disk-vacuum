import {
  HardDriveIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";
import { ScanFolderButton } from "@/features/scan/components/scan-folder-button";
import { ScanHomeButton } from "@/features/scan/components/scan-home-button";
import { ScanProgressPanel } from "@/features/scan/components/scan-progress-panel";
import { useScanStore } from "@/stores/scan-store";

export function NoScanSection() {
  const errorMessage = useScanStore((state) => state.errorMessage);
  const scanStatus = useScanStore((state) => state.status);
  const showScanStatus = ["scanning", "cancelling", "cancelled"].includes(
    scanStatus,
  );

  return (
    <SectionCard className="overflow-hidden">
      <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
        <div className="max-w-2xl">
          <div className="mb-5 grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <HardDriveIcon className="size-5" />
          </div>
          <p className="text-sm font-medium text-primary">
            Ready to inspect your storage
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Start with a location you trust.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            DiskVacuum analyzes the folder or drive you choose, then presents
            the largest consumers and possible cleanup candidates for review.
          </p>
          {errorMessage && (
            <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p>{errorMessage}</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button disabled>
              <HardDriveIcon data-icon="inline-start" />
              Scan Drive
            </Button>
            <ScanHomeButton variant="outline" />
            <ScanFolderButton variant="outline" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheckIcon className="size-4 text-emerald-500" />
            Safety first
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This initial scan only reads metadata. Symlinks are not followed,
            and DiskVacuum will always show a review before cleanup is added.
          </p>
        </div>
      </div>
      {showScanStatus && (
        <div className="border-t border-border p-5 sm:px-7 lg:px-8">
          <ScanProgressPanel />
        </div>
      )}
    </SectionCard>
  );
}
