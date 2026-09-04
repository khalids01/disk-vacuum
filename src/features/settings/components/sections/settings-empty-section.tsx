import { SettingsIcon } from "lucide-react";
import { EmptyState } from "@/components/core/empty-state";

export function SettingsEmptySection() {
  return (
    <EmptyState
      icon={SettingsIcon}
      title="Settings will appear here"
      description="Scan preferences, exclusions, and safety controls will be available as their backing behavior is implemented."
    />
  );
}
