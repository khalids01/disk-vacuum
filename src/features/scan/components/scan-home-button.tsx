import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HomeIcon, LoaderCircleIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { scanHomeDirectory } from "@/features/scan/api/scan-api";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
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
  const queryClient = useQueryClient();
  const status = useScanStore((state) => state.status);
  const startScan = useScanStore((state) => state.startScan);
  const completeScan = useScanStore((state) => state.completeScan);
  const failScan = useScanStore((state) => state.failScan);
  const scanHome = useMutation({
    mutationFn: scanHomeDirectory,
    onMutate: startScan,
    onSuccess: (summary) => {
      queryClient.setQueryData(currentScanQuery.queryKey, summary);
      completeScan();
    },
    onError: (error) => {
      failScan(
        error instanceof Error
          ? error.message
          : "DiskVacuum could not complete the home scan.",
      );
    },
  });

  const isScanning = status === "scanning" || scanHome.isPending;

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
