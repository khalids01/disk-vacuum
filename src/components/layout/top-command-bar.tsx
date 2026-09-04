import { RotateCwIcon, SearchIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function TopCommandBar() {
  return (
    <header className="flex h-16 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur lg:px-6">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold lg:hidden">DiskVacuum</p>
        <p className="hidden text-sm text-muted-foreground lg:block">
          Storage analysis workspace
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled
        className="hidden sm:inline-flex"
      >
        <SearchIcon data-icon="inline-start" />
        Search
        <kbd className="ml-2 hidden rounded border border-border px-1 font-mono text-[10px] text-muted-foreground xl:inline">
          ⌘ K
        </kbd>
      </Button>
      <Button
        variant="outline"
        size="icon"
        disabled
        aria-label="Rescan unavailable until a target is selected"
      >
        <RotateCwIcon />
      </Button>
      <ThemeToggle />
    </header>
  );
}
