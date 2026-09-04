import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import type { ScanProgress } from "@/features/scan/api/scan-api";
import { useScanStore } from "@/stores/scan-store";

export function ScanProgressBridge() {
  const updateProgress = useScanStore((state) => state.updateProgress);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<ScanProgress>("scan-progress", (event) => {
      updateProgress(event.payload);
    }).then((removeListener) => {
      if (disposed) {
        removeListener();
        return;
      }

      unlisten = removeListener;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [updateProgress]);

  return null;
}
