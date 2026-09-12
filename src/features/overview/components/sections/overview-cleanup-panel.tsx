import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, BoxesIcon, BracesIcon, CopyIcon } from "lucide-react";
import { SectionCard } from "@/components/core/section-card";

const opportunities = [
  {
    title: "Developer files",
    description: "Regeneratable project data",
    to: "/developer-cleanup" as const,
    icon: BracesIcon,
    color: "bg-emerald-400",
  },
  {
    title: "Large files",
    description: "Personal review required",
    to: "/large-files" as const,
    icon: BoxesIcon,
    color: "bg-sky-400",
  },
  {
    title: "Duplicates",
    description: "Confirmed matching files",
    to: "/duplicates" as const,
    icon: CopyIcon,
    color: "bg-violet-400",
  },
];

export function OverviewCleanupPanel() {
  return (
    <SectionCard className="flex min-h-full flex-col overflow-hidden border-primary/15 bg-card/90 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
          Cleanup opportunities
        </p>
        <Link
          to="/cleanup"
          className="text-[10px] font-bold tracking-[0.1em] text-primary uppercase hover:text-primary/80"
        >
          View all
        </Link>
      </div>

      <p className="mt-6 text-3xl font-bold tracking-[-0.05em]">Find space</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Run focused checks, compare the results, and review every item before
        cleanup.
      </p>

      <div className="mt-5 divide-y divide-border border-y border-border">
        {opportunities.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex items-center gap-3 py-4"
          >
            <span className={`h-9 w-1 shrink-0 rounded-full ${item.color}`} />
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
              <item.icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold">{item.title}</span>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                {item.description}
              </span>
            </span>
            <ArrowRightIcon className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>

      <Link
        to="/cleanup"
        className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground shadow-[0_12px_28px_-16px_oklch(0.79_0.15_158)] hover:bg-primary/85"
      >
        Review cleanup
        <ArrowRightIcon className="size-3.5" />
      </Link>
    </SectionCard>
  );
}
