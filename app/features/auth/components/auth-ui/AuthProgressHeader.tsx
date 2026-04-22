import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export interface AuthProgressHeaderProps {
  headline: string;
  subcopy?: ReactNode;
  className?: string;
}

export function AuthProgressHeader({
  headline,
  subcopy,
  className,
}: AuthProgressHeaderProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <h3 className="text-text text-base leading-snug font-semibold">
        {headline}
      </h3>
      {subcopy ? (
        <p className="text-text-secondary text-sm leading-relaxed">{subcopy}</p>
      ) : null}
    </div>
  );
}
