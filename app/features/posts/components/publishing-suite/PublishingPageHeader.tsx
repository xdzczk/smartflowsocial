import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function PublishingPageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
