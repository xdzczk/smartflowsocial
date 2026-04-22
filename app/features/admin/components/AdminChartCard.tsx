import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { AdminCard, type AdminCardVariant } from "./AdminCard";

export function AdminChartCard({
  title,
  subtitle,
  legend,
  empty,
  emptyTitle,
  emptyDescription,
  emptySuggestedRange,
  confidenceHint,
  variant = "default",
  className,
  chartClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  empty?: boolean;
  /** Overrides default empty copy. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptySuggestedRange?: string;
  /** Shown under subtitle when metric confidence is low (set by loader). */
  confidenceHint?: string;
  variant?: AdminCardVariant;
  className?: string;
  chartClassName?: string;
  children: ReactNode;
}) {
  const emptyHeading = emptyTitle ?? "No data in this range";
  return (
    <AdminCard
      variant={variant}
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle ? (
            <p className="text-text-secondary mt-0.5 text-xs">{subtitle}</p>
          ) : null}
          {confidenceHint ? (
            <p className="text-text-secondary/90 mt-1 text-[11px] leading-snug">
              {confidenceHint}
            </p>
          ) : null}
        </div>
        {legend ? (
          <div className="text-text-secondary flex flex-wrap gap-2 text-xs">
            {legend}
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "min-h-[220px] flex-1",
          empty && "flex items-center justify-center",
          chartClassName
        )}
      >
        {empty ? (
          <div className="text-text-secondary max-w-md px-2 text-center text-sm">
            <p className="text-text/90 font-medium">{emptyHeading}</p>
            {emptyDescription ? (
              <p className="mt-2 text-xs leading-relaxed">{emptyDescription}</p>
            ) : null}
            {emptySuggestedRange ? (
              <p className="mt-2 text-xs italic">{emptySuggestedRange}</p>
            ) : null}
          </div>
        ) : (
          children
        )}
      </div>
    </AdminCard>
  );
}
