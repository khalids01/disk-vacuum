import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AppState {
  isSidebarCollapsed: boolean;
  zoomLevel: number;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  toggleSidebar: () => void;
  setZoomLevel: (zoomLevel: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export const MIN_ZOOM_LEVEL = 0.8;
export const MAX_ZOOM_LEVEL = 1.5;
export const ZOOM_STEP = 0.1;

function normalizeZoom(value: number) {
  return (
    Math.round(Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, value)) * 10) /
    10
  );
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      zoomLevel: 1,
      setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setZoomLevel: (zoomLevel) => set({ zoomLevel: normalizeZoom(zoomLevel) }),
      zoomIn: () =>
        set((state) => ({
          zoomLevel: normalizeZoom(state.zoomLevel + ZOOM_STEP),
        })),
      zoomOut: () =>
        set((state) => ({
          zoomLevel: normalizeZoom(state.zoomLevel - ZOOM_STEP),
        })),
      resetZoom: () => set({ zoomLevel: 1 }),
    }),
    {
      name: "disk-vacuum-app-shell",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        zoomLevel: state.zoomLevel,
      }),
    },
  ),
);
