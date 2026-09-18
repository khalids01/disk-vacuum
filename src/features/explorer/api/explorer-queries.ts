import { queryOptions } from "@tanstack/react-query";
import type { ScanCategory } from "@/features/scan/api/scan-api";
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
  category?: ScanCategory,
) {
  return queryOptions({
    queryKey: [
      "scan-directory",
      scanVersion,
      directoryId,
      offset,
      limit,
      category,
    ],
    queryFn: () => getScanDirectory(directoryId, offset, limit, category),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
