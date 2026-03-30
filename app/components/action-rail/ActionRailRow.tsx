import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export type ActionRailRowTone =
  | "default"
  | "muted"
  | "warning"
  | "success"
  | "destructive";

/** Visual weight within a rail section (independent of tone). */
export type ActionRailRowEmphasis = "primary" | "default" | "muted";

export function ActionRailRow({
  label,
  value,
  tone = "default",
  placeholder,
  emphasis = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: ActionRailRowTone;
  /** When true, value column uses muted placeholder styling */
  placeholder?: boolean;
  emphasis?: ActionRailRowEmphasis;
  className?: string;
}) {
  const valueTone =
    placeholder || tone === "muted"
      ? "text-muted-foreground"
      : tone === "warning"
        ? "text-amber-950 dark:text-amber-100"
        : tone === "success"
          ? "text-emerald-900 dark:text-emerald-100"
          : tone === "destructive"
            ? "text-destructive"
            : "text-foreground font-medium";

  const labelClass =
    emphasis === "primary"
      ? "text-muted-foreground shrink-0 font-semibold"
      : emphasis === "muted"
        ? "text-muted-foreground/65 shrink-0 text-[10px] font-normal tracking-wide uppercase"
        : "text-muted-foreground shrink-0 font-medium";

  const valueClass = cn(
    "min-w-0 text-right",
    placeholder ? "text-muted-foreground font-normal" : valueTone,
    emphasis === "primary" && !placeholder && "font-semibold",
    emphasis === "muted" && !placeholder && "text-[10px] font-normal"
  );

  return (
    <div
      className={cn(
        "flex justify-between gap-2 text-[11px] leading-snug",
        emphasis === "muted" && "text-[10px]",
        className
      )}
    >
      <span className={labelClass}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
