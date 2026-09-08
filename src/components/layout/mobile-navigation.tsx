import { MenuIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SidebarContent } from "@/components/layout/sidebar-content";
import { Button } from "@/components/ui/button";
import { UpdateSidebarNotice } from "@/features/updates/components/update-control";

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        aria-controls="mobile-navigation-drawer"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <MenuIcon />
      </Button>
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/45"
              onClick={() => setIsOpen(false)}
            />
            <aside
              id="mobile-navigation-drawer"
              aria-label="DiskVacuum navigation"
              className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-2.5rem))] flex-col border-r border-border bg-sidebar shadow-2xl"
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
                <div className="flex items-center gap-3">
                  <img
                    src="/app-icon.png"
                    alt=""
                    className="size-8 rounded-lg"
                  />
                  <div>
                    <p className="text-sm font-semibold tracking-tight">
                      DiskVacuum
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Storage utility
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close navigation"
                  onClick={() => setIsOpen(false)}
                >
                  <XIcon />
                </Button>
              </div>
              <SidebarContent onNavigate={() => setIsOpen(false)} />
              <UpdateSidebarNotice />
            </aside>
          </div>,
          document.body,
        )}
    </div>
  );
}
