import type { ReactNode } from "react";

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
      className={cn(
        "border-border bg-surface/40 shadow-1 overflow-x-auto rounded-xl border",
        className
      )}
    >
      <table
        className={cn(
          "w-full text-sm",
          density === "compact"
            ? "[&_td]:p-1.5 [&_th]:p-1.5"
            : "[&_td]:p-2 [&_th]:p-2",
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
        "bg-surface-hover/45 border-border sticky top-0 z-[1] border-b backdrop-blur-sm",
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
      <td
        colSpan={colSpan}
        className="text-text-secondary p-8 text-center text-sm"
      >
        {children}
      </td>
    </tr>
  );
}
