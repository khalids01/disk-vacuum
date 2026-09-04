import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">Desktop storage management</p>
      <h1 className="text-3xl font-semibold tracking-tight">Disk Vacuum</h1>
      <p className="max-w-xl text-muted-foreground">
        The application shell is ready. Add routes in <code>src/routes</code> to
        extend the desktop experience.
      </p>
      <Button disabled>Scan controls are coming next</Button>
    </section>
  );
}
