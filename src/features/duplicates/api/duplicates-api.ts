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
export interface CleanupIssue {
  id: number;
  path: string;
  reason: string;
}
export interface CleanupPreview {
  ready: DuplicateFile[];
  rejected: CleanupIssue[];
  reclaimableSizeBytes: number;
}
export interface CleanupResult {
  movedIds: number[];
  failed: CleanupIssue[];
  processedSizeBytes: number;
  reclaimedSizeBytes: number;
}
export const previewDuplicateCleanup = (fileIds: number[]) =>
  invoke<CleanupPreview>("preview_duplicate_cleanup", { fileIds });
export const trashDuplicateFiles = (fileIds: number[]) =>
  invoke<CleanupResult>("trash_duplicate_files", { fileIds });

export const analyzeDuplicates = (minimumSizeBytes: number) =>
  invoke<DuplicateReport>("analyze_duplicates", { minimumSizeBytes });
export const cancelDuplicateAnalysis = () =>
  invoke<boolean>("cancel_duplicate_analysis");
export const getDuplicateReport = () =>
  invoke<DuplicateReport | null>("get_duplicate_report");
