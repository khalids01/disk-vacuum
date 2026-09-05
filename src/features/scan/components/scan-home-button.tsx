import { HomeIcon } from "lucide-react";
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
}

export function ScanHomeButton({
  children = "Scan Home",
  ...buttonProps
}: ScanHomeButtonProps) {
  const status = useScanStore((state) => state.status);
  const scanHome = useScanMutation(scanHomeDirectory);
  const isScanActive =
    status === "scanning" || status === "cancelling" || scanHome.isPending;

  return (
    <Button
      {...buttonProps}
      disabled={isScanActive}
      onClick={() => scanHome.mutate()}
    >
      <HomeIcon data-icon="inline-start" />
      {children}
    </Button>
  );
}
