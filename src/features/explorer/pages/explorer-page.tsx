import { PageHeader } from "@/components/core/page-header";
import { ExplorerEmptySection } from "@/features/explorer/components/sections/explorer-empty-section";

export function ExplorerPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Explorer"
        title="Browse storage by folder"
        description="Follow your scanned folders from the root down without leaving DiskVacuum."
      />
      <ExplorerEmptySection />
    </div>
  );
}
