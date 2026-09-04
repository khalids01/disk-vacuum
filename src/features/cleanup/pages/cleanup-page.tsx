import { PageHeader } from "@/components/core/page-header";
import { CleanupEmptySection } from "@/features/cleanup/components/sections/cleanup-empty-section";

export function CleanupPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cleanup hub"
        title="Review before you reclaim"
        description="Cleanup stays deliberate: inspect candidates, select items, then review the exact action."
      />
      <CleanupEmptySection />
    </div>
  );
}
