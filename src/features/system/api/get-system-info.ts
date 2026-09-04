import { invoke } from "@tauri-apps/api/core";

export interface VolumeInfo {
  name: string;
  mountPoint: string;
  fileSystem: string;
  totalSpaceBytes: number;
  availableSpaceBytes: number;
  isRemovable: boolean;
}

export interface SystemInfo {
  operatingSystem: string;
  osVersion: string | null;
  hostname: string | null;
  uptimeSeconds: number;
  totalMemoryBytes: number;
  availableMemoryBytes: number;
  cpuCount: number;
  volumes: VolumeInfo[];
}

export function getSystemInfo() {
  return invoke<SystemInfo>("get_system_info");
}
