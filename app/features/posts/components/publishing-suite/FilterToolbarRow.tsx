import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * Unified filter toolbar layout for Scheduled / Published.
 *
 * Responsive strategy:
 * - Below sm: row1 = type + queue (side by side when queue is shown), row2 = dates + presets
 * - sm to lg: two-column row for type + queue, dates span below
 * - lg+: single row — type (left), dates + presets (centered in the middle track), queue (right)
 */
export function FilterToolbarRow({
  typeControl,
  queueControl,
  dateControls,
  presetControls,
  className,
}: {
  typeControl: ReactNode;
  queueControl?: ReactNode;
  dateControls: ReactNode;
  presetControls?: ReactNode;
  className?: string;
}) {
  const hasQueue = queueControl != null;

  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-[auto_1fr_auto] lg:items-center",
        className
      )}
    >
      <div
        className={cn(
          "min-w-0 sm:contents",
          hasQueue && "flex gap-2 max-sm:gap-3"
        )}
      >
        <div className={cn("min-w-0", hasQueue && "max-sm:flex-1")}>
          {typeControl}
        </div>
        {hasQueue ? (
          <div className="min-w-0 max-sm:flex-1 sm:justify-self-end lg:order-3 lg:justify-self-end">
            {queueControl}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 sm:col-span-2 lg:order-2 lg:col-span-1">
        <div className="flex flex-wrap items-center gap-3 lg:justify-center">
          {dateControls}
          {presetControls ? (
            <div className="flex flex-wrap items-center gap-2">
              {presetControls}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
