import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function PublishingEmptyState({
  icon,
  title,
  description,
  children,
  className,
  "data-testid": dataTestId,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <div
      data-testid={dataTestId}
      className={cn(
        "text-muted-foreground flex flex-col items-center justify-center gap-3 px-4 py-16 text-center",
        className
      )}
    >
      {icon ? (
        <div className="text-muted-foreground/80 [&_svg]:size-12">{icon}</div>
      ) : null}
      <h2 className="text-foreground text-base font-semibold">{title}</h2>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed">{description}</p>
      ) : null}
      {children ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}
