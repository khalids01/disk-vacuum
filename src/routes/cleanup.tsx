import { createFileRoute } from "@tanstack/react-router";
import { CleanupPage } from "@/features/cleanup/pages/cleanup-page";

export const Route = createFileRoute("/cleanup")({ component: CleanupPage });
