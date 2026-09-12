import { Outlet } from "@tanstack/react-router";
import { CleanupQueueBar } from "@/components/layout/cleanup-queue-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { TopCommandBar } from "@/components/layout/top-command-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app-store";

export function AppShell() {
  const collapsed = useAppStore((state) => state.isSidebarCollapsed);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);

  return (
    <TooltipProvider>
      <SidebarProvider
        open={!collapsed}
        onOpenChange={(open) => setSidebarCollapsed(!open)}
        className="relative h-svh min-h-0 overflow-hidden bg-background text-foreground"
      >
        <Sidebar />
        <SidebarInset className="min-w-0 overflow-hidden">
          <TopCommandBar />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <Outlet />
            </div>
          </div>
          <CleanupQueueBar />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
