import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function PathText({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "truncate font-mono text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
