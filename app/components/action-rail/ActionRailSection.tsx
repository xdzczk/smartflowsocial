import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { RAIL_PAD_X, RAIL_ZONE_PY } from "./tokens";

export function ActionRailSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(RAIL_PAD_X, RAIL_ZONE_PY, className)}>{children}</div>
  );
}
