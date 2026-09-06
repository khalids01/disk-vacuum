import { invoke } from "@tauri-apps/api/core";
import type { ScanCategory, ScanNodeKind } from "@/features/scan/api/scan-api";

export interface ScanSearchResult {
  id: number;
  parentDirectoryId: number;
  name: string;
  kind: ScanNodeKind;
  sizeBytes: number;
  category: ScanCategory;
  path: string;
  modifiedAtUnixSeconds: number | null;
}

export interface ScanSearchResponse {
  query: string;
  matchedCount: number;
  results: ScanSearchResult[];
  superseded: boolean;
  elapsedMilliseconds: number;
}

export function searchScan(query: string, limit = 50) {
  return invoke<ScanSearchResponse>("search_scan", { query, limit });
}
