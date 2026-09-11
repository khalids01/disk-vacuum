import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CleanupTarget } from "@/features/cleanup/api/cleanup-api";

export type CleanupSource =
  | "explorer"
  | "largeFiles"
  | "developer"
  | "aiStorage"
  | "appLeftovers"
  | "duplicates";
export interface CleanupQueueItem extends CleanupTarget {
  source: CleanupSource;
  nodeKind: "file" | "directory";
  duplicateGroupId?: string;
  cleanupType?: string;
}

interface CleanupQueueState {
  scanVersion: number | null;
  items: Map<string, CleanupQueueItem>;
  add: (items: CleanupQueueItem[], scanVersion: number) => void;
  remove: (path: string) => void;
  removeIds: (ids: number[]) => void;
  clear: () => void;
}

const normalized = (path: string) =>
  path.replace(/\\\\/g, "/").replace(/\/+$/, "").toLowerCase();
const contains = (parent: string, child: string) =>
  child === parent || child.startsWith(`${parent}/`);

export const useCleanupQueueStore = create<CleanupQueueState>()(
  persist(
    (set) => ({
  scanVersion: null,
  items: new Map(),
  add: (incoming, scanVersion) =>
    set((state) => {
      const next =
        state.scanVersion === scanVersion
          ? new Map(state.items)
          : new Map<string, CleanupQueueItem>();
      for (const item of incoming) {
        const path = normalized(item.path);
        if ([...next.keys()].some((existing) => contains(existing, path)))
          continue;
        for (const existing of next.keys())
          if (contains(path, existing)) next.delete(existing);
        next.set(path, item);
      }
      return { items: next, scanVersion };
    }),
  remove: (path) =>
    set((state) => {
      const next = new Map(state.items);
      next.delete(normalized(path));
      return { items: next };
    }),
  removeIds: (ids) =>
    set((state) => {
      const removed = new Set(ids);
      return {
        items: new Map(
          [...state.items].filter(([, item]) => !removed.has(item.id)),
        ),
      };
    }),
      clear: () => set({ items: new Map(), scanVersion: null }),
    }),
    {
      name: "disk-vacuum-cleanup-queue",
      version: 1,
      storage: createJSONStorage(() => localStorage, {
        replacer: (_key, value) =>
          value instanceof Map
            ? { __diskVacuumMap: true, entries: [...value.entries()] }
            : value,
        reviver: (_key, value) => {
          if (
            value &&
            typeof value === "object" &&
            "__diskVacuumMap" in value &&
            "entries" in value &&
            Array.isArray(value.entries)
          ) {
            return new Map(value.entries as [string, CleanupQueueItem][]);
          }
          return value;
        },
      }),
      partialize: (state) => ({
        ...state,
        add: state.add,
        remove: state.remove,
        removeIds: state.removeIds,
        clear: state.clear,
      }),
    },
  ),
);
