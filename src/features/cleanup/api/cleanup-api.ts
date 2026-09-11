import { invoke } from "@tauri-apps/api/core";

export interface CleanupTarget {
  id: number;
  parentDirectoryId: number;
  path: string;
  name: string;
  sizeBytes: number;
  requireRegeneratable?: boolean;
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
  processedSizeBytes: number;
  reclaimedSizeBytes: number;
}
const payload = (targets: CleanupTarget[]) =>
  targets.map(
    ({ id, parentDirectoryId, path, sizeBytes, requireRegeneratable }) => ({
      id,
      parentDirectoryId,
      path,
      sizeBytes,
      requireRegeneratable: requireRegeneratable ?? false,
    }),
  );
export const previewCleanupTargets = (targets: CleanupTarget[]) =>
  invoke<CleanupTargetPreview>("preview_cleanup_targets", {
    targets: payload(targets),
  });
export const trashCleanupTargets = (targets: CleanupTarget[]) =>
  invoke<CleanupResult>("trash_cleanup_targets", { targets: payload(targets) });
export const permanentlyDeleteCleanupFiles = (targets: CleanupTarget[]) =>
  invoke<CleanupResult>("permanently_delete_cleanup_files", {
    targets: payload(targets),
  });
