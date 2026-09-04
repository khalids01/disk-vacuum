import { PageHeader } from "@/components/core/page-header";
import { DeveloperCleanupEmptySection } from "@/features/developer-cleanup/components/sections/developer-cleanup-empty-section";

export function DeveloperCleanupPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Developer cleanup"
        title="Inspect development storage"
        description="A focused workspace for build caches, package stores, and generated artifacts."
      />
      <DeveloperCleanupEmptySection />
    </div>
  );
}
