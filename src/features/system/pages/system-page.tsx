import { PageHeader } from "@/components/core/page-header";
import { SystemInfoSection } from "@/features/system/components/sections/system-info-section";

export function SystemPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System"
        title="Storage and volume details"
        description="Current device information, reported directly by the operating system."
      />
      <SystemInfoSection />
    </div>
  );
}
