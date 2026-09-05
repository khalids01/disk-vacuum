import { HomeIcon, LoaderCircleIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { scanHomeDirectory } from "@/features/scan/api/scan-api";
import { useScanMutation } from "@/features/scan/hooks/use-scan-mutation";
import { useScanStore } from "@/stores/scan-store";

interface ScanHomeButtonProps
  extends Pick<
    ComponentProps<typeof Button>,
    "className" | "size" | "variant"
  > {
  children?: string;
  compact?: boolean;
}

export function ScanHomeButton({
  children = "Scan Home",
  compact = false,
  ...buttonProps
}: ScanHomeButtonProps) {
  const status = useScanStore((state) => state.status);
  const scanHome = useScanMutation(scanHomeDirectory);
  const isScanning =
    status === "scanning" || status === "cancelling" || scanHome.isPending;

  return (
    <Button
      {...buttonProps}
      disabled={isScanning}
      onClick={() => scanHome.mutate()}
    >
      {isScanning ? (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      ) : (
        <HomeIcon data-icon="inline-start" />
      )}
      {isScanning ? (
        compact ? (
          <span className="sr-only">Scanning Home</span>
        ) : (
          "Scanning Home"
        )
      ) : (
        children
      )}
    </Button>
  );
}
