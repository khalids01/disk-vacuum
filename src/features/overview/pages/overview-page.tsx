import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/core/page-header";
import { NoScanSection } from "@/features/overview/components/sections/no-scan-section";
import { OverviewGuidance } from "@/features/overview/components/sections/overview-guidance";
import { ScanSummarySection } from "@/features/overview/components/sections/scan-summary-section";
import { currentScanQuery } from "@/features/scan/api/scan-queries";

export function OverviewPage() {
  const { data: currentScan } = useQuery(currentScanQuery);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Space map"
        title="Storage overview"
        description={
          currentScan
            ? "A bounded summary of the current completed scan."
            : "Choose a scan target to turn your storage into a clear, reviewable map."
        }
      />
      {currentScan ? (
        <ScanSummarySection summary={currentScan} />
      ) : (
        <NoScanSection />
      )}
      {!currentScan && <OverviewGuidance />}
    </div>
  );
}
