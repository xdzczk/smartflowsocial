import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function ActionRail({
  children,
  footer,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <aside
      className={cn(
        "border-border flex w-full shrink-0 flex-col bg-transparent lg:sticky lg:top-[4.75rem] lg:z-10 lg:max-h-[calc(100dvh-5.75rem)] lg:w-[312px] lg:self-start xl:w-[344px]",
        className
      )}
      aria-label={ariaLabel}
    >
      <div className="border-border bg-card flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    </aside>
  );
}
