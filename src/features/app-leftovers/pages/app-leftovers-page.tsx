import { PageHeader } from "@/components/core/page-header";
import { AppLeftoversEmptySection } from "@/features/app-leftovers/components/sections/app-leftovers-empty-section";

export function AppLeftoversPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="App leftovers"
        title="Find orphaned application data"
        description="Review application support files and leftovers with their likely owner and location."
      />
      <AppLeftoversEmptySection />
    </div>
  );
}
