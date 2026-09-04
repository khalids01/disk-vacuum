import { Code2Icon } from "lucide-react";
import { EmptyState } from "@/components/core/empty-state";

export function DeveloperCleanupEmptySection() {
  return (
    <EmptyState
      icon={Code2Icon}
      title="Developer artifacts are not scanned yet"
      description="Caches, build outputs, package stores, and project artifacts will remain visible and reviewable when analysis is added."
    />
  );
}
