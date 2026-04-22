import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function PostPreviewSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/70 bg-surface-hover/20 shadow-1 overflow-hidden rounded-xl border",
        className
      )}
    >
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}
