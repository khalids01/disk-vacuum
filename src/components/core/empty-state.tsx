import type { LucideIcon } from "lucide-react";
import { SectionCard } from "@/components/core/section-card";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <SectionCard className="grid min-h-64 place-items-center p-6 text-center sm:min-h-72">
      <div className="max-w-sm">
        <div className="mx-auto grid size-11 place-items-center rounded-xl border border-border bg-muted text-primary">
          <Icon className="size-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </SectionCard>
  );
}
