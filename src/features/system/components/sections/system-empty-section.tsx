import { HardDriveIcon } from "lucide-react";
import { EmptyState } from "@/components/core/empty-state";

export function SystemEmptySection() {
  return (
    <EmptyState
      icon={HardDriveIcon}
      title="System storage is not available yet"
      description="Drive capacity, free space, and mount information will appear here when the native system-info command is connected."
    />
  );
}
