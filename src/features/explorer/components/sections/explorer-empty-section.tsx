import { FolderSearch2Icon } from "lucide-react";
import { EmptyState } from "@/components/core/empty-state";

export function ExplorerEmptySection() {
  return (
    <EmptyState
      icon={FolderSearch2Icon}
      title="Explore after your first scan"
      description="DiskVacuum will organize scanned folders by size so you can trace exactly where storage is going."
    />
  );
}
