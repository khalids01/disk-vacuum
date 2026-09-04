import { InfoIcon } from "lucide-react";
import { NoScanSection } from "@/features/overview/components/sections/no-scan-section";
import { OverviewGuidance } from "@/features/overview/components/sections/overview-guidance";

export function OverviewPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Space map</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Storage overview
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <InfoIcon className="size-3.5" />
          No storage data has been collected yet
        </div>
      </div>
      <NoScanSection />
      <OverviewGuidance />
    </div>
  );
}
