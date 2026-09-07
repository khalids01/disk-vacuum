import { queryOptions } from "@tanstack/react-query";
import { getDeveloperCleanup } from "@/features/developer-cleanup/api/developer-cleanup-api";

export function developerCleanupQuery(scanVersion: number) {
  return queryOptions({
    queryKey: ["developer-cleanup", scanVersion],
    queryFn: getDeveloperCleanup,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
