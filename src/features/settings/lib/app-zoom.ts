import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useAppStore } from "@/stores/app-store";

let initialized = false;

function applyZoom(zoomLevel: number) {
  if (!isTauri()) return;

  void getCurrentWebview()
    .setZoom(zoomLevel)
    .catch((error: unknown) => {
      console.error("Unable to change the app zoom level", error);
    });
}

export function initializeAppZoom() {
  if (initialized) return;
  initialized = true;

  applyZoom(useAppStore.getState().zoomLevel);

  useAppStore.subscribe((state, previousState) => {
    if (state.zoomLevel !== previousState.zoomLevel) {
      applyZoom(state.zoomLevel);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;

    const { resetZoom, zoomIn, zoomOut } = useAppStore.getState();
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomIn();
      return;
    }
    if (event.key === "-") {
      event.preventDefault();
      zoomOut();
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      resetZoom();
    }
  });
}
