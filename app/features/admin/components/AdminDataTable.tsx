import type { ReactNode } from "react";

import { StatusIcon } from "~/components/ui/status-icon";
import { cn } from "~/lib/utils";

export function AdminDataTable({
  children,
  className,
  density = "comfortable",
  zebra = false,
}: {
  children: ReactNode;
  className?: string;
  density?: "comfortable" | "compact";
  zebra?: boolean;
}) {
  return (
    <div
      data-density={density === "compact" ? "compact" : undefined}
      className={cn(
        "border-border bg-surface shadow-1 overflow-x-auto rounded-xl border",
        className
      )}
    >
      <table
        className={cn(
          "w-full text-sm",
          // Comfortable padding lives on the table; compact padding comes from
          // the data-density scope above (which targets td/th globally).
          density !== "compact" && "[&_td]:p-2 [&_th]:p-2",
          "[&_tbody_tr]:border-border [&_tbody_tr]:border-b",
          zebra && "[&_tbody_tr:nth-child(even)]:bg-surface-hover/25"
        )}
      >
        {children}
      </table>
    </div>
  );
}

export function AdminDataTableHead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <thead
      className={cn(
        "bg-surface-hover/50 border-border sticky top-0 z-[1] border-b",
        className
      )}
    >
      {children}
    </thead>
  );
}

export function AdminDataTableEmpty({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-8">
        <div className="text-text-secondary flex flex-col items-center justify-center gap-2 text-center text-sm">
          <StatusIcon tone="neutral" size="md" />
          <div>{children}</div>
        </div>
      </td>
    </tr>
  );
}
