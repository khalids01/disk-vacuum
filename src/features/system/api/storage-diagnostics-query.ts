import { queryOptions } from "@tanstack/react-query";
import { getStorageDiagnostics } from "@/features/system/api/storage-diagnostics";

export const storageDiagnosticsQuery = queryOptions({
  queryKey: ["storage-diagnostics"],
  queryFn: getStorageDiagnostics,
  staleTime: 60_000,
});
