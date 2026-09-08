import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { queryClient } from "@/app/query-client";
import { OnboardingDialog } from "@/features/onboarding/components/onboarding-dialog";
import { ScanProgressBridge } from "@/features/scan/components/scan-progress-bridge";
import { GlobalSearch } from "@/features/search/components/global-search";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <ScanProgressBridge />
      <GlobalSearch />
      <OnboardingDialog />
      {children}
    </QueryClientProvider>
  );
}
