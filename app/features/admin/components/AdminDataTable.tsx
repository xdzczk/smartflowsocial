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
        "border-border bg-card/40 overflow-x-auto rounded-xl border shadow-sm",
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
          zebra && "[&_tbody_tr:nth-child(even)]:bg-muted/25"
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
        "bg-muted/45 border-border sticky top-0 z-[1] border-b backdrop-blur-sm",
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
        className="text-muted-foreground p-8 text-center text-sm"
      >
        {children}
      </td>
    </tr>
  );
}
