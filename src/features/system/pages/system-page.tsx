import { PageHeader } from "@/components/core/page-header";
import { SystemEmptySection } from "@/features/system/components/sections/system-empty-section";

export function SystemPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System"
        title="Storage and volume details"
        description="A platform-aware view of connected volumes and available capacity."
      />
      <SystemEmptySection />
    </div>
  );
}
