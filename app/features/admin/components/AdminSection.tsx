import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function AdminSection({
  eyebrow,
  title,
  description,
  actions,
  className,
  id,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  /** For in-app drilldown hash links (e.g. #monetization). */
  id?: string;
  children?: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {eyebrow ? (
            <p className="text-text-secondary text-[11px] font-semibold tracking-[0.12em] uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="text-text-secondary max-w-3xl text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
