import { HardDriveIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { scanSystemStorage } from "@/features/scan/api/scan-api";
import { useScanMutation } from "@/features/scan/hooks/use-scan-mutation";
import { useScanStore } from "@/stores/scan-store";

interface ScanSystemButtonProps
  extends Pick<
    ComponentProps<typeof Button>,
    "className" | "size" | "variant"
  > {
  children?: string;
}

export function ScanSystemButton({
  children = "Scan System",
  ...buttonProps
}: ScanSystemButtonProps) {
  const status = useScanStore((state) => state.status);
  const scanSystem = useScanMutation(scanSystemStorage);
  const isScanActive =
    status === "scanning" || status === "cancelling" || scanSystem.isPending;

  return (
    <Button
      {...buttonProps}
      disabled={isScanActive}
      onClick={() => scanSystem.mutate()}
    >
      <HardDriveIcon data-icon="inline-start" />
      {children}
    </Button>
  );
}
