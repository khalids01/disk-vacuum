import { queryOptions } from "@tanstack/react-query";
import { getAiStorage } from "@/features/ai-storage/api/ai-storage-api";
export function aiStorageQuery(scanVersion: number) {
  return queryOptions({
    queryKey: ["ai-storage", scanVersion],
    queryFn: getAiStorage,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
