import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

const shell = cn(
  "space-y-1 rounded-lg border px-2.5 py-2",
  "text-[11px] leading-snug"
);

export function RailFeedbackBlock({
  variant,
  title,
  lines,
  className,
}: {
  variant: "error" | "warning";
  title: ReactNode;
  lines: string[];
  className?: string;
}) {
  if (variant === "error") {
    return (
      <div
        className={cn(
          shell,
          "border-destructive/45 bg-destructive/10 dark:bg-destructive/15 text-red-900 dark:border-red-900/60 dark:text-red-100",
          className
        )}
      >
        <p className="font-semibold">{title}</p>
        {lines.map((line) => (
          <p key={line} className="opacity-95">
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
        "border-amber-200/80 bg-amber-500/[0.12] text-amber-950 dark:border-amber-800 dark:bg-amber-950/25 dark:text-amber-100",
        className
      )}
    >
      <p className="font-semibold">{title}</p>
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
