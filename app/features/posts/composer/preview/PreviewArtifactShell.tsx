import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/** Feed-aligned surface for composer preview artifacts (post / poll / thread). */
export function PreviewArtifactShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-surface shadow-1 rounded-lg border p-3",
        className
      )}
    >
      {children}
    </div>
  );
}
