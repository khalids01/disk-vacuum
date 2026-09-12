import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground shadow-[0_18px_50px_-30px_rgb(0_0_0_/_0.7)]",
        className,
      )}
      {...props}
    />
  );
}
