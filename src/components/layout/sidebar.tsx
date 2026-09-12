import { SidebarContent } from "@/components/layout/sidebar-content";
import { UpdateSidebarNotice } from "@/features/updates/components/update-control";

export function Sidebar() {
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar/95 shadow-[18px_0_50px_-42px_rgb(0_0_0_/_0.8)] lg:flex">
      <div className="flex h-[4.5rem] shrink-0 items-center gap-3 border-b border-border px-5">
        <img
          src="/app-icon.png"
          alt=""
          className="size-9 rounded-xl shadow-[0_8px_18px_-8px_oklch(0.79_0.15_158)]"
        />
        <div>
          <p className="text-[15px] font-bold tracking-[-0.035em]">
            DiskVacuum
          </p>
          <p className="text-xs text-muted-foreground">Storage utility</p>
        </div>
      </div>
      <SidebarContent />
      <UpdateSidebarNotice />
    </aside>
  );
}
