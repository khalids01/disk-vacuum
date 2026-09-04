import { Trash2Icon } from "lucide-react";
import { EmptyState } from "@/components/core/empty-state";

export function CleanupEmptySection() {
  return (
    <EmptyState
      icon={Trash2Icon}
      title="Nothing is ready for cleanup"
      description="After a scan, DiskVacuum will present reviewable cleanup candidates before anything can be moved to Trash."
    />
  );
}
