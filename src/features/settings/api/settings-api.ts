import { invoke } from "@tauri-apps/api/core";
export type ScanTargetPreference = "system" | "home" | "folder";
export interface AppSettings {
  version: number;
  defaultScanTarget: ScanTargetPreference;
  largeFileThresholdMb: number;
  exclusions: string[];
  onboardingComplete: boolean;
}
export function getSettings() {
  return invoke<AppSettings>("get_settings");
}
export function saveSettings(settings: AppSettings) {
  return invoke<AppSettings>("save_settings", { settings });
}
