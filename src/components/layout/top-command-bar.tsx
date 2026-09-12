import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRightIcon, RotateCwIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSearchStore } from "@/stores/search-store";

export function TopCommandBar() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const openSearch = useSearchStore((state) => state.openSearch);
  const shortcutLabel = navigator.userAgent.includes("Mac") ? "⌘ K" : "Ctrl K";
  const cleanupChild = [
    "/cleanup-queue",
    "/large-files",
    "/duplicates",
    "/developer-cleanup",
    "/ai-storage",
    "/app-leftovers",
  ].includes(pathname);
  const pageLabel: Record<string, string> = {
    "/overview": "Overview",
    "/explorer": "Explore Files",
    "/cleanup": "Clean Up",
    "/cleanup-queue": "Cleanup Queue",
    "/large-files": "Large Files",
    "/duplicates": "Duplicates",
    "/developer-cleanup": "Developer Cleanup",
    "/ai-storage": "AI Storage",
    "/app-leftovers": "App Leftovers",
    "/system": "System",
    "/settings": "Settings",
  };
  const currentLabel = pageLabel[pathname] ?? "DiskVacuum";

  return (
    <header className="relative flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-6">
      <SidebarTrigger
        className="-ml-1"
        aria-label="Toggle sidebar"
        title="Toggle sidebar"
      />
      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-center gap-1.5 text-sm"
      >
        <Link
          to="/overview"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          DiskVacuum
        </Link>
        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
        {cleanupChild && (
          <>
            <Link
              to="/cleanup"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              Clean Up
            </Link>
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate font-semibold">{currentLabel}</span>
      </nav>
      <Button
        variant="outline"
        size="sm"
        className="hidden sm:inline-flex"
        onClick={openSearch}
      >
        <SearchIcon data-icon="inline-start" />
        Search
        <kbd className="ml-2 hidden rounded border border-border px-1 font-mono text-[10px] text-muted-foreground xl:inline">
          {shortcutLabel}
        </kbd>
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="sm:hidden"
        aria-label="Search scanned storage"
        onClick={openSearch}
      >
        <SearchIcon />
      </Button>
      <Button
        variant="outline"
        size="icon"
        disabled
        aria-label="Rescan unavailable until a target is selected"
      >
        <RotateCwIcon />
      </Button>
    </header>
  );
}
