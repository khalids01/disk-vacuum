import { create } from "zustand";

export type ScanStatus = "idle" | "scanning" | "completed" | "failed";

interface ScanState {
  status: ScanStatus;
  errorMessage: string | null;
  startScan: () => void;
  completeScan: () => void;
  failScan: (errorMessage: string) => void;
}

export const useScanStore = create<ScanState>((set) => ({
  status: "idle",
  errorMessage: null,
  startScan: () => set({ status: "scanning", errorMessage: null }),
  completeScan: () => set({ status: "completed", errorMessage: null }),
  failScan: (errorMessage) => set({ status: "failed", errorMessage }),
}));
