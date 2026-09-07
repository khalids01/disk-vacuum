import { queryOptions } from "@tanstack/react-query";
import { getAppLeftovers } from "./app-leftovers-api";
export function appLeftoversQuery(scanVersion: number) {
  return queryOptions({
    queryKey: ["app-leftovers", scanVersion],
    queryFn: getAppLeftovers,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
