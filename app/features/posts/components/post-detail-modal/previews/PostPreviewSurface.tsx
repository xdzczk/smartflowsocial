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
        "border-border/70 bg-muted/20 overflow-hidden rounded-2xl border shadow-sm",
        className
      )}
    >
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}
