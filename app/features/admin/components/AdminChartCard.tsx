import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { AdminCard, type AdminCardVariant } from "./AdminCard";

export function AdminChartCard({
  title,
  subtitle,
  legend,
  empty,
  variant = "default",
  className,
  chartClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  empty?: boolean;
  variant?: AdminCardVariant;
  className?: string;
  chartClassName?: string;
  children: ReactNode;
}) {
  return (
    <AdminCard
      variant={variant}
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle ? (
            <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>
          ) : null}
        </div>
        {legend ? (
          <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
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
          <p className="text-muted-foreground text-sm">
            No data in this range.
          </p>
        ) : (
          children
        )}
      </div>
    </AdminCard>
  );
}
