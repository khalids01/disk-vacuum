import type { MutationFunction } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ScanSummary } from "@/features/scan/api/scan-api";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { useScanStore } from "@/stores/scan-store";

export function useScanMutation<TVariables>(
  mutationFn: MutationFunction<ScanSummary, TVariables>,
) {
  const queryClient = useQueryClient();
  const startScan = useScanStore((state) => state.startScan);
  const completeScan = useScanStore((state) => state.completeScan);
  const failScan = useScanStore((state) => state.failScan);

  return useMutation({
    mutationFn,
    onMutate: startScan,
    onSuccess: (summary) => {
      queryClient.setQueryData(currentScanQuery.queryKey, summary);
      completeScan();
    },
    onError: (error) => {
      failScan(
        error instanceof Error
          ? error.message
          : "DiskVacuum could not complete the scan.",
      );
    },
  });
}
