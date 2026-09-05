import { queryOptions } from "@tanstack/react-query";
import { getScanTreemap } from "@/features/scan/api/scan-api";

export function scanTreemapQuery(
  scanVersion: number,
  directoryId: number,
  maxNodes = 48,
) {
  return queryOptions({
    queryKey: ["scan-treemap", scanVersion, directoryId, maxNodes],
    queryFn: () => getScanTreemap(directoryId, maxNodes),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
