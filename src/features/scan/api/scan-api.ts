import { invoke } from "@tauri-apps/api/core";

export type ScanNodeKind = "file" | "directory";
export type ScanCategory =
  | "applications"
  | "documents"
  | "downloads"
  | "images"
  | "video"
  | "audio"
  | "archives"
  | "developer"
  | "ai"
  | "caches"
  | "system"
  | "other";
export type ScanErrorCode =
  | "scan_cancelled"
  | "scan_failed"
  | "scan_persistence_failed"
  | "scan_already_running"
  | "state_unavailable";

export interface ScanCommandError {
  code: ScanErrorCode;
  message: string;
}

export interface ScanCapacity {
  totalSpaceBytes: number;
  usedSpaceBytes: number;
  freeSpaceBytes: number;
  availableSpaceBytes: number;
  reservedSpaceBytes: number;
}

export type ScanProgressStage = "scanning" | "saving";

export interface ScanProgress {
  stage: ScanProgressStage;
  targetLabel: string;
  entriesVisited: number;
  bytesObserved: number;
  elapsedMilliseconds: number;
  capacity: ScanCapacity | null;
}

export type ScanTreemapNodeKind = "file" | "directory" | "group";

export interface ScanTreemapNode {
  id: number | null;
  name: string;
  kind: ScanTreemapNodeKind;
  sizeBytes: number;
  category: ScanCategory;
  groupedItemCount: number;
}

export interface ScanNodeDetails {
  id: number;
  parentDirectoryId: number;
  name: string;
  kind: ScanNodeKind;
  sizeBytes: number;
  category: ScanCategory;
  path: string;
  childCount: number;
  modifiedAtUnixSeconds: number | null;
}

export interface ScanTreemapSummary {
  directoryId: number;
  parentId: number | null;
  name: string;
  totalItems: number;
  nodes: ScanTreemapNode[];
}

export interface ScanBreadcrumbItem {
  id: number;
  name: string;
}

export interface ScanDirectoryPage {
  directoryId: number;
  parentId: number | null;
  name: string;
  totalItems: number;
  offset: number;
  items: ScanNodeSummary[];
}

export interface ScanCategorySummary {
  category: ScanCategory;
  sizeBytes: number;
  fileCount: number;
}

export interface ScanNodeSummary {
  id: number;
  name: string;
  kind: ScanNodeKind;
  sizeBytes: number;
  category: ScanCategory;
  modifiedAtUnixSeconds: number | null;
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
  categories: ScanCategorySummary[];
}

export function getScanNodeDetails(directoryId: number, nodeId: number) {
  return invoke<ScanNodeDetails>("get_scan_node_details", {
    directoryId,
    nodeId,
  });
}

export function getScanTreemap(directoryId: number, maxNodes = 48) {
  return invoke<ScanTreemapSummary>("get_scan_treemap", {
    directoryId,
    maxNodes,
  });
}

export function getScanBreadcrumbs(directoryId: number) {
  return invoke<ScanBreadcrumbItem[]>("get_scan_breadcrumbs", { directoryId });
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
