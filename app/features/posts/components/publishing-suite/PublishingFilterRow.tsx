import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

type PublishingFilterRowProps =
  | {
      /** Unified row layout override (use for new toolbar systems). */
      children: ReactNode;
      className?: string;
    }
  | {
      leading: ReactNode;
      trailing: ReactNode;
      className?: string;
    };

export function PublishingFilterRow(props: PublishingFilterRowProps) {
  const className = "className" in props ? props.className : undefined;
  return (
    <div
      className={cn(
        "border-border stack mb-4 border-b pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3",
        className
      )}
    >
      {"children" in props ? (
        <div className="flex w-full min-w-0 flex-col">{props.children}</div>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-shrink-0 items-center">
            {props.leading}
          </div>
          <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center gap-3 sm:justify-end">
            {props.trailing}
          </div>
        </>
      )}
    </div>
  );
}
