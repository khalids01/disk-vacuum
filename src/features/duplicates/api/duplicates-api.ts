import { invoke } from "@tauri-apps/api/core";
export interface DuplicateProgress {
  stage: "sizing" | "partialHash" | "fullHash" | "complete";
  processed: number;
  total: number;
}
export interface DuplicateFile {
  id: number;
  parentDirectoryId: number;
  path: string;
  name: string;
  sizeBytes: number;
  modifiedAtUnixSeconds: number | null;
  recommendedKeep: boolean;
}
export interface DuplicateGroup {
  id: string;
  fileSizeBytes: number;
  reclaimableSizeBytes: number;
  files: DuplicateFile[];
}
export interface DuplicateReport {
  groupCount: number;
  duplicateFileCount: number;
  reclaimableSizeBytes: number;
  groups: DuplicateGroup[];
}
export const analyzeDuplicates = (minimumSizeBytes: number) =>
  invoke<DuplicateReport>("analyze_duplicates", { minimumSizeBytes });
export const cancelDuplicateAnalysis = () =>
  invoke<boolean>("cancel_duplicate_analysis");
export const getDuplicateReport = () =>
  invoke<DuplicateReport | null>("get_duplicate_report");
