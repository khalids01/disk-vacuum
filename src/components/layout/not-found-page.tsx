import { Link } from "@tanstack/react-router";
import { CompassIcon } from "lucide-react";
import { useEffect } from "react";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Page not found | DiskVacuum";
  }, []);

  return (
    <SectionCard className="grid min-h-72 place-items-center p-6 text-center sm:min-h-96">
      <div className="max-w-sm">
        <div className="mx-auto grid size-11 place-items-center rounded-xl border border-border bg-muted text-primary">
          <CompassIcon className="size-5" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Page not found</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          This workspace view does not exist
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Return to the storage overview to choose another area of DiskVacuum.
        </p>
        <Button className="mt-5" render={<Link to="/overview" />}>
          Go to Space Map
        </Button>
      </div>
    </SectionCard>
  );
}
