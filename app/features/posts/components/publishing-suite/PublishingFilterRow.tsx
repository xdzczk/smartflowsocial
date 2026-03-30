import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function PublishingFilterRow({
  leading,
  trailing,
  className,
}: {
  leading: ReactNode;
  trailing: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border mb-6 flex flex-col gap-4 border-b pb-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3",
        className
      )}
    >
      <div className="min-w-0 flex-1 overflow-x-auto">{leading}</div>
      <div className="flex min-w-0 flex-shrink-0 flex-wrap items-end gap-3 sm:justify-end">
        {trailing}
      </div>
    </div>
  );
}
