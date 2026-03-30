import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export type CompactStatusVariant = "info" | "warning" | "error";

const shells: Record<CompactStatusVariant, string> = {
  info: cn("border-border/80 bg-muted/30 text-foreground", "dark:bg-muted/20"),
  warning: cn(
    "border-amber-500/35 bg-amber-500/[0.08] text-amber-950",
    "dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-100"
  ),
  error: cn(
    "border-destructive/40 bg-destructive/10 text-destructive",
    "dark:bg-destructive/15"
  ),
};

/**
 * Thin inline status: neutral info, warning, or error — not full slabs.
 */
export function CompactStatusMessage({
  variant,
  children,
  className,
  id,
}: {
  variant: CompactStatusVariant;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      role={variant === "error" ? "alert" : undefined}
      className={cn(
        "rounded-md border px-2.5 py-2 text-xs leading-snug",
        shells[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
