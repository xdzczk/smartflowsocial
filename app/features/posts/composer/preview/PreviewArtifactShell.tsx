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
        "border-border-subtle/80 bg-surface shadow-1 rounded-xl border p-3 ring-1 ring-black/[0.02] dark:ring-white/[0.04]",
        className
      )}
    >
      {children}
    </div>
  );
}
