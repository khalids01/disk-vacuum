import { invoke } from "@tauri-apps/api/core";

export type ScanNodeKind = "file" | "directory";
export type ScanErrorCode =
  | "scan_cancelled"
  | "scan_failed"
  | "scan_already_running"
  | "state_unavailable";

export interface ScanCommandError {
  code: ScanErrorCode;
  message: string;
}

export interface ScanCapacity {
  totalSpaceBytes: number;
  usedSpaceBytes: number;
}

export interface ScanProgress {
  targetLabel: string;
  entriesVisited: number;
  bytesObserved: number;
  elapsedMilliseconds: number;
  capacity: ScanCapacity | null;
}

export interface ScanDirectoryPage {
  directoryId: number;
  parentId: number | null;
  name: string;
  totalItems: number;
  offset: number;
  items: ScanNodeSummary[];
}

export interface ScanNodeSummary {
  id: number;
  name: string;
  kind: ScanNodeKind;
  sizeBytes: number;
}

export interface ScanSummary {
  targetLabel: string;
  completedAtUnixSeconds: number;
  totalSizeBytes: number;
  capacity: ScanCapacity | null;
  fileCount: number;
  directoryCount: number;
  permissionDeniedCount: number;
  unreadableEntryCount: number;
  skippedSymlinkCount: number;
  skippedHardLinkCount: number;
  skippedMountedFilesystemCount: number;
  skippedSpecialFileCount: number;
  rootDirectoryId: number;
  topLevelItems: ScanNodeSummary[];
}

export function getScanDirectory(directoryId: number, offset = 0, limit = 200) {
  return invoke<ScanDirectoryPage>("get_scan_directory", {
    directoryId,
    offset,
    limit,
  });
}

export function getCurrentScan() {
  return invoke<ScanSummary | null>("get_current_scan");
}

export function scanSystemStorage() {
  return invoke<ScanSummary>("scan_system_storage");
}

export function scanHomeDirectory() {
  return invoke<ScanSummary>("scan_home_directory");
}

export function scanDirectoryPath(path: string) {
  return invoke<ScanSummary>("scan_directory_path", { path });
}

export function cancelCurrentScan() {
  return invoke<boolean>("cancel_scan");
}

export function normalizeScanError(error: unknown): ScanCommandError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  ) {
    return {
      code: error.code as ScanErrorCode,
      message: error.message,
    };
  }

  return {
    code: "scan_failed",
    message:
      error instanceof Error
        ? error.message
        : "DiskVacuum could not complete the scan.",
  };
}
