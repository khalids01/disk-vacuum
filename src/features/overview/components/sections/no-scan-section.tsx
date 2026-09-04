import {
  FolderOpenIcon,
  HardDriveIcon,
  HomeIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { SectionCard } from "@/components/core/section-card";
import { Button } from "@/components/ui/button";

export function NoScanSection() {
  return (
    <SectionCard className="overflow-hidden">
      <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
        <div className="max-w-2xl">
          <div className="mb-5 grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <HardDriveIcon className="size-5" />
          </div>
          <p className="text-sm font-medium text-primary">
            Ready to inspect your storage
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Start with a location you trust.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            DiskVacuum analyzes the folder or drive you choose, then presents
            the largest consumers and possible cleanup candidates for review.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button disabled>
              <HardDriveIcon data-icon="inline-start" />
              Scan Drive
            </Button>
            <Button variant="outline" disabled>
              <HomeIcon data-icon="inline-start" />
              Scan Home
            </Button>
            <Button variant="outline" disabled>
              <FolderOpenIcon data-icon="inline-start" />
              Choose Folder
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheckIcon className="size-4 text-emerald-500" />
            Safety first
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Scans only inspect storage. DiskVacuum will always show a review
            before any cleanup action is available.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
