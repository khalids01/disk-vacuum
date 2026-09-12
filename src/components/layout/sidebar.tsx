import { Link } from "@tanstack/react-router";
import { SidebarContent as AppSidebarContent } from "@/components/layout/sidebar-content";
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  Sidebar as SidebarPrimitive,
  useSidebar,
} from "@/components/ui/sidebar";
import { UpdateSidebarNotice } from "@/features/updates/components/update-control";

export function Sidebar() {
  const { isMobile, state } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  return (
    <SidebarPrimitive variant="floating" collapsible="icon">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="DiskVacuum"
              render={<Link to="/overview" />}
              className="group-data-[collapsible=icon]:justify-center"
            >
              <img
                src="/app-icon.png"
                alt=""
                className="size-8 shrink-0 rounded-lg shadow-[0_8px_18px_-8px_oklch(0.79_0.15_158)]"
              />
              <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="block truncate text-sm font-bold tracking-tight">
                  DiskVacuum
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Storage utility
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <AppSidebarContent collapsed={collapsed} />
      </SidebarContent>
      <SidebarFooter className="p-0 group-data-[collapsible=icon]:hidden">
        <UpdateSidebarNotice />
      </SidebarFooter>
    </SidebarPrimitive>
  );
}
