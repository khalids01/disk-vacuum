import { Link } from "@tanstack/react-router";
import { HardDriveIcon } from "lucide-react";
import { navigationGroups } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";

interface SidebarContentProps {
  onNavigate?: () => void;
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-medium text-muted-foreground">Scan target</p>
        <p className="mt-1 text-sm font-medium">No scan selected</p>
        <Button className="mt-3 w-full" size="sm" disabled>
          <HardDriveIcon data-icon="inline-start" />
          Scan Drive
        </Button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" disabled>
            Home
          </Button>
          <Button variant="outline" size="sm" disabled>
            Folder
          </Button>
        </div>
      </div>

      {navigationGroups.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                activeProps={{ className: "bg-accent text-accent-foreground" }}
                className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
