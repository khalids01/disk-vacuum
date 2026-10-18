import { invoke } from "@tauri-apps/api/core";

export interface InstalledApp {
  key: string;
  name: string;
  source: string;
  installedBytes: number | null;
  installationPath: string | null;
  cacheBytes: number | null;
  cachePath: string | null;
  uninstallAvailable: boolean;
}

export const getInstalledApps = () =>
  invoke<InstalledApp[]>("get_installed_apps");
export const clearAppCache = (key: string) =>
  invoke<void>("clear_app_cache", { key });
export const uninstallApp = (key: string) =>
  invoke<void>("uninstall_app", { key });
