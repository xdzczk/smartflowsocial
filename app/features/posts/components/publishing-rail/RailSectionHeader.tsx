import type { ReactNode } from "react";

import { ActionRailLabel } from "~/components/action-rail/ActionRailLabel";

export function RailSectionHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <ActionRailLabel className={className}>{children}</ActionRailLabel>;
}
