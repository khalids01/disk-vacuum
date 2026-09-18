import { ListPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CleanupTarget } from "@/features/cleanup/api/cleanup-api";
import type { CleanupSource } from "@/stores/cleanup-queue-store";
import { useCleanupQueueStore } from "@/stores/cleanup-queue-store";

export function AddToCleanupQueueButton({
  items,
  source,
  scanVersion,
  label = "Add to Cleanup Queue",
  requireRegeneratable = false,
}: {
  items: CleanupTarget[];
  source: CleanupSource;
  scanVersion: number;
  label?: string;
  requireRegeneratable?: boolean;
}) {
  const add = useCleanupQueueStore((state) => state.add);
  return (
    <Button
      onClick={() => {
        add(
          items.map((item) => ({
            ...item,
            source,
            nodeKind: source === "largeFiles" ? "file" : "directory",
            requireRegeneratable,
            cleanupType:
              "kind" in item && typeof item.kind === "string"
                ? item.kind
                : "dataType" in item && typeof item.dataType === "string"
                  ? item.dataType
                  : source,
            safety: cleanupSafety(item, source),
            consequence: cleanupConsequence(item, source),
          })),
          scanVersion,
        );
      }}
    >
      <ListPlusIcon data-icon="inline-start" />
      {label}
    </Button>
  );
}

function cleanupSafety(item: CleanupTarget, source: CleanupSource) {
  if (source === "duplicates") return "regeneratable" as const;
  if (source === "appLeftovers" || source === "explorer") {
    return "review" as const;
  }
  if ("safety" in item && item.safety === "likelySafe") {
    return "regeneratable" as const;
  }
  return "review" as const;
}

function cleanupConsequence(item: CleanupTarget, source: CleanupSource) {
  if ("consequence" in item && typeof item.consequence === "string") {
    return item.consequence;
  }
  if ("regeneration" in item && typeof item.regeneration === "string") {
    return item.regeneration;
  }
  if ("evidence" in item && typeof item.evidence === "string") {
    return `${item.evidence} Confirm that the application and its data are no longer needed.`;
  }
  if (source === "largeFiles" || source === "explorer") {
    return "This file is not proven regeneratable. Confirm its contents and ownership before removal.";
  }
  if (source === "duplicates") {
    return "One confirmed copy remains; links or workflows that use this exact path may need updating.";
  }
  return "The item may need to be downloaded, rebuilt, or configured again after removal.";
}
