import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { queryClient } from "@/app/query-client";
import type { ScanProgress, ScanSummary } from "@/features/scan/api/scan-api";
import { currentScanQuery } from "@/features/scan/api/scan-queries";
import { useScanStore } from "@/stores/scan-store";

export function ScanProgressBridge() {
  const updateProgress = useScanStore((state) => state.updateProgress);

  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    void Promise.all([
      listen<ScanProgress>("scan-progress", (event) => {
        updateProgress(event.payload);
      }),
      listen<ScanSummary>("scan-restored", (event) => {
        queryClient.setQueryData(currentScanQuery.queryKey, event.payload);
      }),
    ]).then((listeners) => {
      if (disposed) {
        for (const unlisten of listeners) unlisten();
        return;
      }
      unlisteners.push(...listeners);
    });

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) unlisten();
    };
  }, [updateProgress]);

  return null;
}
