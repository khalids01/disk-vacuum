import { invoke } from "@tauri-apps/api/core";

export type ScanNodeKind = "file" | "directory";

export interface ScanProgress {
  targetLabel: string;
  entriesVisited: number;
  bytesObserved: number;
  elapsedMilliseconds: number;
}

export interface ScanNodeSummary {
  id: string;
  name: string;
  kind: ScanNodeKind;
  sizeBytes: number;
}

export interface ScanSummary {
  targetLabel: string;
  completedAtUnixSeconds: number;
  totalSizeBytes: number;
  fileCount: number;
  directoryCount: number;
  permissionDeniedCount: number;
  unreadableEntryCount: number;
  skippedSymlinkCount: number;
  skippedSpecialFileCount: number;
  topLevelItems: ScanNodeSummary[];
}

export function getCurrentScan() {
  return invoke<ScanSummary | null>("get_current_scan");
}

export function scanHomeDirectory() {
  return invoke<ScanSummary>("scan_home_directory");
}

export function scanDirectoryPath(path: string) {
  return invoke<ScanSummary>("scan_directory_path", { path });
}
