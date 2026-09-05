import type { MutationFunction } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  normalizeScanError,
  type ScanSummary,
} from "@/features/scan/api/scan-api";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { useScanStore } from "@/stores/scan-store";

export function useScanMutation<TVariables>(
  mutationFn: MutationFunction<ScanSummary, TVariables>,
) {
  const queryClient = useQueryClient();
  const startScan = useScanStore((state) => state.startScan);
  const completeScan = useScanStore((state) => state.completeScan);
  const cancelScan = useScanStore((state) => state.cancelScan);
  const failScan = useScanStore((state) => state.failScan);

  return useMutation({
    mutationFn,
    onMutate: startScan,
    onSuccess: (summary) => {
      queryClient.setQueryData(currentScanQuery.queryKey, summary);
      completeScan();
    },
    onError: (error) => {
      const scanError = normalizeScanError(error);
      if (scanError.code === "scan_cancelled") {
        cancelScan();
        return;
      }

      failScan(scanError.message);
    },
  });
}
