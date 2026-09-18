import { invoke } from "@tauri-apps/api/core";

export interface StorageDiagnostic {
  id: string;
  title: string;
  kind: string;
  detectedSizeBytes: number | null;
  reclaimableSizeBytes: number | null;
  itemCount: number | null;
  safety: "regeneratable" | "review" | "serviceAction" | "unavailable";
  detail: string;
  cleanupMethod: string;
  available: boolean;
}

export interface StorageDiagnostics {
  platform: string;
  diagnostics: StorageDiagnostic[];
}

export function getStorageDiagnostics() {
  return invoke<StorageDiagnostics>("get_storage_diagnostics");
}
