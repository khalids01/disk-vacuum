import type { ScanCategory } from "@/features/scan/api/scan-api";

const categoryLabels: Record<ScanCategory, string> = {
  applications: "Applications",
  documents: "Documents",
  downloads: "Downloads",
  images: "Images",
  video: "Video",
  audio: "Audio",
  archives: "Archives",
  developer: "Developer",
  ai: "AI",
  caches: "Caches",
  system: "System",
  other: "Other",
};

export function formatScanCategory(category: ScanCategory) {
  return categoryLabels[category];
}
