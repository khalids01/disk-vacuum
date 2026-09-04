import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { queryClient } from "@/app/query-client";
import { ScanProgressBridge } from "@/features/scan/components/scan-progress-bridge";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <ScanProgressBridge />
      {children}
    </QueryClientProvider>
  );
}
