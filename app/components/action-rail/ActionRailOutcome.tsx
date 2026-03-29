import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { RAIL_STACK_TIGHT } from "./tokens";

export function ActionRailOutcome({
  headline,
  outcomeLine,
  hint,
  className,
}: {
  headline?: ReactNode;
  outcomeLine?: string | null;
  hint?: string | null;
  className?: string;
}) {
  return (
    <div className={cn(RAIL_STACK_TIGHT, className)}>
      {hint ? (
        <p className="text-muted-foreground text-[11px] leading-snug">{hint}</p>
      ) : null}
      <p className="text-foreground text-[11px] leading-snug">
        {headline ? <span className="font-medium">{headline}</span> : null}
        {outcomeLine ? (
          <span className="text-muted-foreground">
            {headline ? " · " : null}
            {outcomeLine}
          </span>
        ) : null}
      </p>
    </div>
  );
}
