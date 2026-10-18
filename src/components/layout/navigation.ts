import type { LucideIcon } from "lucide-react";
import {
  FolderSearch2Icon,
  LayoutDashboardIcon,
  PackageIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";

export type AppRoute =
  | "/overview"
  | "/explorer"
  | "/cleanup"
  | "/cleanup-queue"
  | "/large-files"
  | "/duplicates"
  | "/developer-cleanup"
  | "/ai-storage"
  | "/app-leftovers"
  | "/installed-apps"
  | "/system"
  | "/settings";

export interface NavigationItem {
  label: string;
  description?: string;
  icon: LucideIcon;
  to: AppRoute;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        label: "Overview",
        description: "Storage health and next steps",
        icon: LayoutDashboardIcon,
        to: "/overview",
      },
      {
        label: "Explore Files",
        description: "Browse scanned folders",
        icon: FolderSearch2Icon,
        to: "/explorer",
      },
      {
        label: "Clean Up",
        description: "Review reclaimable storage",
        icon: SparklesIcon,
        to: "/cleanup",
      },
      {
        label: "Installed Apps",
        description: "Linux app storage and cache",
        icon: PackageIcon,
        to: "/installed-apps",
      },
    ],
  },
  {
    label: "Preferences",
    items: [
      {
        label: "Settings",
        description: "Scanning, appearance, and safety",
        icon: SettingsIcon,
        to: "/settings",
      },
    ],
  },
];
