import { createFileRoute } from "@tanstack/react-router";
import { SystemPage } from "@/features/system/pages/system-page";

export const Route = createFileRoute("/system")({ component: SystemPage });
