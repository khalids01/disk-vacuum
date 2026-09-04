import { SparklesIcon } from "lucide-react";
import { EmptyState } from "@/components/core/empty-state";

export function AppLeftoversEmptySection() {
  return (
    <EmptyState
      icon={SparklesIcon}
      title="No app leftovers identified"
      description="DiskVacuum will only surface leftovers after it can relate them to an installed or removed application safely."
    />
  );
}
