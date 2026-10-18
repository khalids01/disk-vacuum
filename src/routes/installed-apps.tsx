import { createFileRoute } from "@tanstack/react-router";
import { InstalledAppsPage } from "@/features/installed-apps/installed-apps-page";

export const Route = createFileRoute("/installed-apps")({
  component: InstalledAppsPage,
});
