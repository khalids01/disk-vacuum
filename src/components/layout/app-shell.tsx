import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/components/layout/sidebar";
import { TopCommandBar } from "@/components/layout/top-command-bar";

export function AppShell() {
  return (
    <div className="min-h-svh bg-background text-foreground lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopCommandBar />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
