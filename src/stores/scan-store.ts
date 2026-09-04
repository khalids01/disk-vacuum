import { create } from "zustand";
import type { ScanProgress } from "@/features/scan/api/scan-api";

export type ScanStatus = "idle" | "scanning" | "completed" | "failed";

interface ScanState {
  status: ScanStatus;
  progress: ScanProgress | null;
  errorMessage: string | null;
  startScan: () => void;
  updateProgress: (progress: ScanProgress) => void;
  completeScan: () => void;
  failScan: (errorMessage: string) => void;
}

export const useScanStore = create<ScanState>((set) => ({
  status: "idle",
  progress: null,
  errorMessage: null,
  startScan: () =>
    set({ status: "scanning", progress: null, errorMessage: null }),
  updateProgress: (progress) => set({ progress }),
  completeScan: () =>
    set({ status: "completed", progress: null, errorMessage: null }),
  failScan: (errorMessage) =>
    set({ status: "failed", progress: null, errorMessage }),
}));
