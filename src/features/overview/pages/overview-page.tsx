import { PageHeader } from "@/components/core/page-header";
import { NoScanSection } from "@/features/overview/components/sections/no-scan-section";
import { OverviewGuidance } from "@/features/overview/components/sections/overview-guidance";

export function OverviewPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Space map"
        title="Storage overview"
        description="Choose a scan target to turn your storage into a clear, reviewable map."
      />
      <NoScanSection />
      <OverviewGuidance />
    </div>
  );
}
