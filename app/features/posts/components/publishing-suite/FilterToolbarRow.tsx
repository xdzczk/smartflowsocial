import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * Unified filter toolbar layout for Scheduled / Published.
 *
 * Responsive strategy (wrap_b):
 * - Small screens: row1 = type + queue, row2 = dates + presets
 * - Large screens: single row with left cluster (type + dates + presets) and right cluster (queue)
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
  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-[auto_1fr_auto] lg:items-center",
        className
      )}
    >
      <div className="min-w-0">{typeControl}</div>

      <div className="min-w-0 sm:justify-self-end lg:order-3 lg:justify-self-end">
        {queueControl ?? null}
      </div>

      <div className="min-w-0 sm:col-span-2 lg:order-2 lg:col-span-1">
        <div className="flex flex-wrap items-center gap-3">
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
