import { create } from "zustand";
import type { ScanProgress } from "@/features/scan/api/scan-api";

export type ScanStatus =
  | "idle"
  | "scanning"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

interface ScanState {
  status: ScanStatus;
  progress: ScanProgress | null;
  errorMessage: string | null;
  startScan: () => void;
  updateProgress: (progress: ScanProgress) => void;
  requestCancellation: () => void;
  completeScan: () => void;
  cancelScan: () => void;
  failScan: (errorMessage: string) => void;
}

export const useScanStore = create<ScanState>((set) => ({
  status: "idle",
  progress: null,
  errorMessage: null,
  startScan: () =>
    set({ status: "scanning", progress: null, errorMessage: null }),
  updateProgress: (progress) => set({ progress }),
  requestCancellation: () => set({ status: "cancelling" }),
  completeScan: () =>
    set({ status: "completed", progress: null, errorMessage: null }),
  cancelScan: () =>
    set({ status: "cancelled", progress: null, errorMessage: null }),
  failScan: (errorMessage) =>
    set({ status: "failed", progress: null, errorMessage }),
}));
