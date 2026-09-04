import { Link } from "@tanstack/react-router";
import { MenuIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { navigationGroups } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? <XIcon /> : <MenuIcon />}
      </Button>
      {isOpen && (
        <nav className="absolute inset-x-0 top-16 z-20 max-h-[calc(100svh-4rem)] overflow-y-auto border-b border-border bg-background p-4 shadow-lg">
          <div className="mx-auto grid max-w-2xl gap-5 sm:grid-cols-3">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsOpen(false)}
                      activeProps={{
                        className: "bg-accent text-accent-foreground",
                      }}
                      className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
