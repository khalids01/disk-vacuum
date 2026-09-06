import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  getLargeFiles,
  type LargeFilesQueryInput,
} from "@/features/large-files/api/large-files-api";

export function largeFilesQuery(
  scanVersion: number,
  input: LargeFilesQueryInput,
) {
  return queryOptions({
    queryKey: ["large-files", scanVersion, input],
    queryFn: () => getLargeFiles(input),
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
