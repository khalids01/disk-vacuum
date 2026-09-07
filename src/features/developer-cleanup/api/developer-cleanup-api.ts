import { invoke } from "@tauri-apps/api/core";
import type { LargeFileSafety } from "@/features/large-files/api/large-files-api";

export type DeveloperArtifactKind =
  | "nodeModules"
  | "buildOutput"
  | "rustTarget"
  | "pythonVirtualEnvironment"
  | "pythonCache"
  | "packageCache"
  | "temporaryBuildOutput";

export interface DeveloperCleanupItem {
  id: number;
  parentDirectoryId: number;
  name: string;
  path: string;
  projectName: string;
  sizeBytes: number;
  modifiedAtUnixSeconds: number | null;
  kind: DeveloperArtifactKind;
  safety: LargeFileSafety;
  explanation: string;
  regeneration: string;
}

export interface DeveloperCleanupGroup {
  kind: DeveloperArtifactKind;
  itemCount: number;
  totalSizeBytes: number;
  items: DeveloperCleanupItem[];
}

export interface DeveloperCleanupReport {
  totalCount: number;
  totalSizeBytes: number;
  displayedCount: number;
  groups: DeveloperCleanupGroup[];
}

export function getDeveloperCleanup() {
  return invoke<DeveloperCleanupReport>("get_developer_cleanup");
}
