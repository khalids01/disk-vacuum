import { CopyIcon } from "lucide-react";
import { EmptyState } from "@/components/core/empty-state";

export function DuplicatesEmptySection() {
  return (
    <EmptyState
      icon={CopyIcon}
      title="No duplicate groups yet"
      description="Duplicate analysis is separate from basic scanning and will only run when you ask it to."
    />
  );
}
