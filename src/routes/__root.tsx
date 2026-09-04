import { Link, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";
import type { QueryClient } from "@tanstack/react-query";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link to="/" className="text-sm font-semibold tracking-tight">
          Disk Vacuum
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <section className="space-y-2">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-sm underline underline-offset-4">
        Go home
      </Link>
    </section>
  );
}
