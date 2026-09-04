import { queryOptions } from "@tanstack/react-query";
import { getCurrentScan } from "@/features/scan/api/scan-api";

export const currentScanQuery = queryOptions({
  queryKey: ["current-scan"],
  queryFn: getCurrentScan,
  staleTime: Number.POSITIVE_INFINITY,
});
