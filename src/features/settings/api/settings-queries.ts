import { queryOptions } from "@tanstack/react-query";
import { getSettings } from "./settings-api";
export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: getSettings,
  staleTime: Number.POSITIVE_INFINITY,
});
