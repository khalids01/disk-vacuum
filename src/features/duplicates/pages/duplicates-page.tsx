import { PageHeader } from "@/components/core/page-header";
import { DuplicatesEmptySection } from "@/features/duplicates/components/sections/duplicates-empty-section";

export function DuplicatesPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Duplicates"
        title="Compare duplicate files carefully"
        description="When duplicate analysis is available, each group will show a clear keep/remove recommendation to review."
      />
      <DuplicatesEmptySection />
    </div>
  );
}
