import { queryOptions } from "@tanstack/react-query";
import {
  getScanBreadcrumbs,
  getScanDirectory,
} from "@/features/scan/api/scan-api";

export function scanBreadcrumbsQuery(scanVersion: number, directoryId: number) {
  return queryOptions({
    queryKey: ["scan-breadcrumbs", scanVersion, directoryId],
    queryFn: () => getScanBreadcrumbs(directoryId),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function scanDirectoryQuery(
  scanVersion: number,
  directoryId: number,
  offset: number,
  limit: number,
) {
  return queryOptions({
    queryKey: ["scan-directory", scanVersion, directoryId, offset, limit],
    queryFn: () => getScanDirectory(directoryId, offset, limit),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
