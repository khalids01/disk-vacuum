import { invoke } from "@tauri-apps/api/core";
import type { LargeFileSafety } from "@/features/large-files/api/large-files-api";
export type AiStorageDataType =
  | "models"
  | "cache"
  | "logs"
  | "sessions"
  | "indexes"
  | "other";
export interface AiStorageItem {
  id: number;
  parentDirectoryId: number;
  path: string;
  name: string;
  tool: string;
  sizeBytes: number;
  modifiedAtUnixSeconds: number | null;
  dataType: AiStorageDataType;
  safety: LargeFileSafety;
  consequence: string;
}
export interface AiStorageGroup {
  tool: string;
  totalSizeBytes: number;
  items: AiStorageItem[];
}
export interface AiStorageReport {
  totalSizeBytes: number;
  safeCacheSizeBytes: number;
  modelSizeBytes: number;
  itemCount: number;
  groups: AiStorageGroup[];
}
export function getAiStorage() {
  return invoke<AiStorageReport>("get_ai_storage");
}
