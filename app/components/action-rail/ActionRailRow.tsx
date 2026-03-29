import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export type ActionRailRowTone =
  | "default"
  | "muted"
  | "warning"
  | "success"
  | "destructive";

export function ActionRailRow({
  label,
  value,
  tone = "default",
  placeholder,
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: ActionRailRowTone;
  /** When true, value column uses muted placeholder styling */
  placeholder?: boolean;
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

  return (
    <div
      className={cn(
        "flex justify-between gap-2 text-[11px] leading-snug",
        className
      )}
    >
      <span className="text-muted-foreground shrink-0 font-medium">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 text-right",
          placeholder ? "text-muted-foreground font-normal" : valueTone
        )}
      >
        {value}
      </span>
    </div>
  );
}
