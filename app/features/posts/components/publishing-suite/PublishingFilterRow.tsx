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
        "border-border mb-4 flex flex-row flex-wrap items-center justify-between gap-2 border-b pb-4",
        className
      )}
    >
      {"children" in props ? (
        <div className="flex w-full min-w-0 flex-col">{props.children}</div>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 items-center">
            {props.leading}
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            {props.trailing}
          </div>
        </>
      )}
    </div>
  );
}
