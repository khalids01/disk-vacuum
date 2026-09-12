import { Outlet } from "@tanstack/react-router";
import { CleanupQueueBar } from "@/components/layout/cleanup-queue-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { TopCommandBar } from "@/components/layout/top-command-bar";

export function AppShell() {
  return (
    <div className="relative flex h-svh overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <TopCommandBar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
        <CleanupQueueBar />
      </div>
    </div>
  );
}
