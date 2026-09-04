import { HardDriveIcon } from "lucide-react";
import { SidebarContent } from "@/components/layout/sidebar-content";

export function Sidebar() {
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
        <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <HardDriveIcon className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">DiskVacuum</p>
          <p className="text-xs text-muted-foreground">Storage utility</p>
        </div>
      </div>
      <SidebarContent />
    </aside>
  );
}
