import { PageHeader } from "@/components/core/page-header";
import { AiStorageEmptySection } from "@/features/ai-storage/components/sections/ai-storage-empty-section";

export function AiStoragePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="AI storage"
        title="Understand model and cache storage"
        description="Review AI-related files by source before deciding what to keep or clear."
      />
      <AiStorageEmptySection />
    </div>
  );
}
