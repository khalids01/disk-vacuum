import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";

type UpdateStatus =
  | "idle"
  | "checking"
  | "upToDate"
  | "available"
  | "downloading"
  | "installed"
  | "error";
interface UpdateState {
  status: UpdateStatus;
  currentVersion: string | null;
  version: string | null;
  notes: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
  error: string | null;
  update: Update | null;
  checkForUpdate: (manual?: boolean) => Promise<void>;
  installAndRestart: () => Promise<void>;
}
let checking: Promise<void> | null = null;
export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: "idle",
  currentVersion: null,
  version: null,
  notes: null,
  downloadedBytes: 0,
  totalBytes: null,
  error: null,
  update: null,
  checkForUpdate: async (manual = false) => {
    if (checking) return checking;
    checking = (async () => {
      set({ status: "checking", error: null });
      try {
        const [currentVersion, update] = await Promise.all([
          getVersion(),
          check({ timeout: 15_000 }),
        ]);
        if (!update) {
          set({
            status: "upToDate",
            currentVersion,
            version: null,
            notes: null,
            update: null,
          });
          return;
        }
        set({
          status: "available",
          currentVersion,
          version: update.version,
          notes: update.body ?? null,
          update,
        });
      } catch (error) {
        set({
          status: manual ? "error" : "idle",
          error: manual ? readableError(error) : null,
        });
      } finally {
        checking = null;
      }
    })();
    return checking;
  },
  installAndRestart: async () => {
    const update = get().update;
    if (!update) return;
    let downloadedBytes = 0;
    set({
      status: "downloading",
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
    });
    try {
      await update.downloadAndInstall(
        (event) => {
          if (event.event === "Started")
            set({ totalBytes: event.data.contentLength ?? null });
          if (event.event === "Progress") {
            downloadedBytes += event.data.chunkLength;
            set({ downloadedBytes });
          }
        },
        { timeout: 10 * 60_000 },
      );
      set({ status: "installed" });
      await relaunch();
    } catch (error) {
      set({ status: "error", error: readableError(error) });
    }
  },
}));
function readableError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
