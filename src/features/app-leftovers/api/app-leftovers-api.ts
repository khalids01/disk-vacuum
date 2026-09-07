import { invoke } from "@tauri-apps/api/core";
export type AppLeftoverConfidence = "high" | "likely" | "review";
export interface AppLeftoverItem {
  id: number;
  parentDirectoryId: number;
  path: string;
  name: string;
  appName: string;
  sizeBytes: number;
  modifiedAtUnixSeconds: number | null;
  confidence: AppLeftoverConfidence;
  evidence: string;
}
export interface AppLeftoverGroup {
  appName: string;
  totalSizeBytes: number;
  items: AppLeftoverItem[];
}
export interface AppLeftoversReport {
  totalSizeBytes: number;
  itemCount: number;
  highConfidenceCount: number;
  groups: AppLeftoverGroup[];
}
export function getAppLeftovers() {
  return invoke<AppLeftoversReport>("get_app_leftovers");
}
