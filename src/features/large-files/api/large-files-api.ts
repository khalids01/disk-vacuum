import { invoke } from "@tauri-apps/api/core";
import type { ScanCategory } from "@/features/scan/api/scan-api";

export type LargeFileSort =
  | "sizeDescending"
  | "modifiedNewest"
  | "modifiedOldest"
  | "nameAscending";
export type LargeFileSafety = "likelySafe" | "review" | "protected";

export interface LargeFileItem {
  id: number;
  parentDirectoryId: number;
  name: string;
  path: string;
  parentPath: string;
  extension: string | null;
  sizeBytes: number;
  modifiedAtUnixSeconds: number | null;
  category: ScanCategory;
  safety: LargeFileSafety;
}

export interface LargeFilesPage {
  totalCount: number;
  totalSizeBytes: number;
  offset: number;
  items: LargeFileItem[];
}

export interface LargeFilesQueryInput {
  minimumSizeBytes: number;
  category: ScanCategory | null;
  extension: string | null;
  modifiedBeforeUnixSeconds: number | null;
  sort: LargeFileSort;
  offset: number;
  limit: number;
}

export function getLargeFiles(input: LargeFilesQueryInput) {
  return invoke<LargeFilesPage>("get_large_files", { request: input });
}
