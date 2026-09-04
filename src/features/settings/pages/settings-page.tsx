import { PageHeader } from "@/components/core/page-header";
import { SettingsEmptySection } from "@/features/settings/components/sections/settings-empty-section";

export function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Control how DiskVacuum works"
        description="Configure future scan preferences and exclusions from one predictable place."
      />
      <SettingsEmptySection />
    </div>
  );
}
