import { PageHeader } from "@/components/core/page-header";
import { LargeFilesEmptySection } from "@/features/large-files/components/sections/large-files-empty-section";

export function LargeFilesPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Large files"
        title="Find the biggest files first"
        description="Sort the largest scanned files and decide what is worth keeping, moving, or removing."
      />
      <LargeFilesEmptySection />
    </div>
  );
}
