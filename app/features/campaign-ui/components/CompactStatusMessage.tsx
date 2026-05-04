import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export type CompactStatusVariant = "info" | "warning" | "error";

const shells: Record<CompactStatusVariant, string> = {
  info: cn(
    "border-border/80 bg-surface-hover/30 text-text",
    "dark:bg-surface-hover/20"
  ),
  warning: cn(
    "border-warning/35 bg-warning/[0.08] text-warning-text",
    "dark:border-warning/40 dark:bg-warning/20 dark:text-warning"
  ),
  error: cn("border-danger/40 bg-danger/10 text-danger", "dark:bg-danger/15"),
};

/**
 * Thin inline status: neutral info, warning, or error  -  not full slabs.
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
