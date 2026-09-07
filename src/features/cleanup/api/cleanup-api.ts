import { invoke } from "@tauri-apps/api/core";

export interface CleanupTarget {
  id: number;
  parentDirectoryId: number;
  path: string;
  name: string;
  sizeBytes: number;
}
export interface CleanupIssue {
  id: number;
  path: string;
  reason: string;
}
export interface CleanupTargetPreview {
  ready: CleanupTarget[];
  rejected: CleanupIssue[];
  reclaimableSizeBytes: number;
}
export interface CleanupResult {
  movedIds: number[];
  failed: CleanupIssue[];
  reclaimedSizeBytes: number;
}
const payload = (targets: CleanupTarget[]) =>
  targets.map(({ id, parentDirectoryId, path, sizeBytes }) => ({
    id,
    parentDirectoryId,
    path,
    sizeBytes,
  }));
export const previewCleanupTargets = (targets: CleanupTarget[]) =>
  invoke<CleanupTargetPreview>("preview_cleanup_targets", {
    targets: payload(targets),
  });
export const trashCleanupTargets = (targets: CleanupTarget[]) =>
  invoke<CleanupResult>("trash_cleanup_targets", { targets: payload(targets) });
