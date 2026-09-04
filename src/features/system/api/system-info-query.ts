import { queryOptions } from "@tanstack/react-query";
import { getSystemInfo } from "@/features/system/api/get-system-info";

export const systemInfoQuery = queryOptions({
  queryKey: ["system-info"],
  queryFn: getSystemInfo,
  staleTime: 60_000,
});
