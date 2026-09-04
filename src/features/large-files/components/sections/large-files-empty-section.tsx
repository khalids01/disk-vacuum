import { FilesIcon } from "lucide-react";
import { EmptyState } from "@/components/core/empty-state";

export function LargeFilesEmptySection() {
  return (
    <EmptyState
      icon={FilesIcon}
      title="No large files indexed"
      description="Scan a drive, home directory, or accessible folder to find the files that have the biggest storage impact."
    />
  );
}
