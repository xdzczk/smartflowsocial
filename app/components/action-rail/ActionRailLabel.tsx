import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { RAIL_HEADER_TO_BODY } from "./tokens";

export function ActionRailLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-text-secondary text-[10px] font-medium tracking-wide uppercase",
        RAIL_HEADER_TO_BODY,
        className
      )}
    >
      {children}
    </p>
  );
}
