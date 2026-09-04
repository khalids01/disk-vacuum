import { BotIcon } from "lucide-react";
import { EmptyState } from "@/components/core/empty-state";

export function AiStorageEmptySection() {
  return (
    <EmptyState
      icon={BotIcon}
      title="AI storage has not been analyzed"
      description="Model files, caches, and logs will be grouped here with their source and removal implications made clear."
    />
  );
}
