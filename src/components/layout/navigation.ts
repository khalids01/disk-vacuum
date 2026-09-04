import type { LucideIcon } from "lucide-react";
import {
  BotIcon,
  Code2Icon,
  CopyIcon,
  FilesIcon,
  FolderSearch2Icon,
  HardDriveIcon,
  SettingsIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";

export type AppRoute =
  | "/overview"
  | "/explorer"
  | "/cleanup"
  | "/large-files"
  | "/duplicates"
  | "/developer-cleanup"
  | "/ai-storage"
  | "/app-leftovers"
  | "/system"
  | "/settings";

export interface NavigationItem {
  label: string;
  icon: LucideIcon;
  to: AppRoute;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Explore",
    items: [
      { label: "Space Map", icon: HardDriveIcon, to: "/overview" },
      { label: "Explorer", icon: FolderSearch2Icon, to: "/explorer" },
    ],
  },
  {
    label: "Cleanup",
    items: [
      { label: "Cleanup Hub", icon: Trash2Icon, to: "/cleanup" },
      { label: "Large Files", icon: FilesIcon, to: "/large-files" },
      { label: "Duplicates", icon: CopyIcon, to: "/duplicates" },
      { label: "Developer", icon: Code2Icon, to: "/developer-cleanup" },
      { label: "AI Storage", icon: BotIcon, to: "/ai-storage" },
      { label: "App Leftovers", icon: SparklesIcon, to: "/app-leftovers" },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "System", icon: HardDriveIcon, to: "/system" },
      { label: "Settings", icon: SettingsIcon, to: "/settings" },
    ],
  },
];
