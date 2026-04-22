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
          // Wash + saturated dark/light text token (--danger-text adapts per scheme).
          "border-danger/40 bg-danger/12 text-danger-text",
          className
        )}
      >
        <p className="font-semibold">{title}</p>
        {lines.map((line) => (
          <p key={line} className="text-danger-text/90">
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
          "border-brand/30 bg-brand/8 text-brand-text",
          className
        )}
      >
        <p className="font-semibold">{title}</p>
        {lines.map((line) => (
          <p key={line} className="text-brand-text/85">
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
        "border-warning/45 bg-warning/12 text-warning-text",
        className
      )}
    >
      <p className="font-semibold">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-warning-text/90">
          {line}
        </p>
      ))}
    </div>
  );
}
