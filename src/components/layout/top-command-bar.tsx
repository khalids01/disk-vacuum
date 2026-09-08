import { RotateCwIcon, SearchIcon } from "lucide-react";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { UpdateControl } from "@/features/updates/components/update-control";
import { useSearchStore } from "@/stores/search-store";

export function TopCommandBar() {
  const openSearch = useSearchStore((state) => state.openSearch);
  const shortcutLabel = navigator.userAgent.includes("Mac") ? "⌘ K" : "Ctrl K";

  return (
    <header className="relative flex h-16 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur lg:px-6">
      <MobileNavigation />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold lg:hidden">DiskVacuum</p>
        <p className="hidden text-sm text-muted-foreground lg:block">
          Storage analysis workspace
        </p>
      </div>
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
      <UpdateControl compact />
      <ThemeToggle />
    </header>
  );
}
