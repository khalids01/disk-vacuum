import { queryOptions } from "@tanstack/react-query";
import {
  getScanNodeDetails,
  getScanTreemap,
} from "@/features/scan/api/scan-api";

export function scanNodeDetailsQuery(
  scanVersion: number,
  directoryId: number,
  nodeId: number,
) {
  return queryOptions({
    queryKey: ["scan-node-details", scanVersion, directoryId, nodeId],
    queryFn: () => getScanNodeDetails(directoryId, nodeId),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

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
