import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function ProofStudioLayout({
  header,
  entitySelector,
  preview,
  controlRail,
  className,
}: {
  header?: ReactNode;
  entitySelector: ReactNode;
  preview: ReactNode;
  controlRail: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {header}
      <div
        className={cn(
          "grid gap-6",
          "lg:grid-cols-[minmax(200px,260px)_1fr_minmax(280px,320px)]",
          "lg:items-start"
        )}
      >
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          {entitySelector}
        </div>
        <div className="min-w-0">{preview}</div>
        <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          {controlRail}
        </div>
      </div>
    </div>
  );
}

/** Admin: preview + rail only (no entity column) */
export function ProofStudioAdminLayout({
  header,
  preview,
  controlRail,
  className,
}: {
  header?: ReactNode;
  preview: ReactNode;
  controlRail: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      {header}
      <div
        className={cn(
          "grid gap-6",
          "lg:grid-cols-[1fr_minmax(280px,340px)]",
          "lg:items-start"
        )}
      >
        <div className="min-w-0">{preview}</div>
        <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          {controlRail}
        </div>
      </div>
    </div>
  );
}
