import { SidebarContent } from "@/components/layout/sidebar-content";
import { UpdateSidebarNotice } from "@/features/updates/components/update-control";

export function Sidebar() {
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
        <img src="/app-icon.png" alt="" className="size-8 rounded-lg" />
        <div>
          <p className="text-sm font-semibold tracking-tight">DiskVacuum</p>
          <p className="text-xs text-muted-foreground">Storage utility</p>
        </div>
      </div>
      <SidebarContent />
      <UpdateSidebarNotice />
    </aside>
  );
}
