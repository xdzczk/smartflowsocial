import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

const shell = cn(
  "space-y-1 rounded-lg border px-2.5 py-2",
  "text-[11px] leading-snug"
);

export type ActionRailNoticeVariant = "error" | "warning" | "info";

export function ActionRailNotice({
  variant,
  title,
  lines,
  className,
}: {
  variant: ActionRailNoticeVariant;
  title: ReactNode;
  lines: string[];
  className?: string;
}) {
  if (variant === "error") {
    return (
      <div
        className={cn(
          shell,
          "border-destructive/45 bg-destructive/10 text-red-950",
          /* Dark: stronger surface + light text so body copy stays readable on near-black UI */
          "dark:border-red-500/45 dark:bg-red-950/55 dark:text-red-50",
          className
        )}
      >
        <p className="font-semibold">{title}</p>
        {lines.map((line) => (
          <p key={line} className="text-red-950/95 dark:text-red-50/95">
            {line}
          </p>
        ))}
      </div>
    );
  }

  if (variant === "info") {
    return (
      <div
        className={cn(
          shell,
          "border-primary/30 bg-primary/5 text-foreground dark:border-primary/40 dark:bg-primary/10",
          className
        )}
      >
        <p className="font-semibold">{title}</p>
        {lines.map((line) => (
          <p key={line} className="text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        shell,
        "border-amber-200/80 bg-amber-500/[0.12] text-amber-950",
        "dark:border-amber-500/45 dark:bg-amber-950/50 dark:text-amber-50",
        className
      )}
    >
      <p className="font-semibold">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-amber-950/95 dark:text-amber-50/95">
          {line}
        </p>
      ))}
    </div>
  );
}
