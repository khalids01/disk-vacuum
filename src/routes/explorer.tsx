import { createFileRoute } from "@tanstack/react-router";
import { ExplorerPage } from "@/features/explorer/pages/explorer-page";

export const Route = createFileRoute("/explorer")({ component: ExplorerPage });
