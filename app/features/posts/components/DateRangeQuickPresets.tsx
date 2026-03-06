/**
 * Quick preset buttons for date range: next/past 7 days and 30 days.
 * Renders next to the date range filter on Scheduled (next) and Published/Recyclables (past).
 */

import {
  getNext7DaysRange,
  getNext30DaysRange,
  getPast7DaysRange,
  getPast30DaysRange,
} from "../utils/date-range-filter";

import type { DateRangeValue } from "./DateRangeFilter";

interface DateRangeQuickPresetsProps {
  variant: "future" | "past";
  userTimezone: string;
  onDateRangeChange: (range: DateRangeValue) => void;
  className?: string;
}

export function DateRangeQuickPresets({
  variant,
  userTimezone,
  onDateRangeChange,
  className,
}: DateRangeQuickPresetsProps) {
  const tz = userTimezone.trim() || "UTC";

  if (variant === "future") {
    return (
      <div
        className={`flex flex-shrink-0 items-center gap-1 ${className ?? ""}`}
        role="group"
        aria-label="Quick date range presets"
      >
        <button
          type="button"
          onClick={() => onDateRangeChange(getNext7DaysRange(tz))}
          className="text-muted-foreground hover:text-foreground focus:ring-ring rounded px-2 py-1 text-xs font-medium underline-offset-2 transition-colors hover:underline focus:ring-2 focus:ring-offset-0 focus:outline-none"
        >
          Next 7 days
        </button>
        <span className="text-muted-foreground/60 text-xs" aria-hidden>
          |
        </span>
        <button
          type="button"
          onClick={() => onDateRangeChange(getNext30DaysRange(tz))}
          className="text-muted-foreground hover:text-foreground focus:ring-ring rounded px-2 py-1 text-xs font-medium underline-offset-2 transition-colors hover:underline focus:ring-2 focus:ring-offset-0 focus:outline-none"
        >
          Next 30 days
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center gap-1 ${className ?? ""}`}
      role="group"
      aria-label="Quick date range presets"
    >
      <button
        type="button"
        onClick={() => onDateRangeChange(getPast7DaysRange(tz))}
        className="text-muted-foreground hover:text-foreground focus:ring-ring rounded px-2 py-1 text-xs font-medium underline-offset-2 transition-colors hover:underline focus:ring-2 focus:ring-offset-0 focus:outline-none"
      >
        Past 7 days
      </button>
      <span className="text-muted-foreground/60 text-xs" aria-hidden>
        |
      </span>
      <button
        type="button"
        onClick={() => onDateRangeChange(getPast30DaysRange(tz))}
        className="text-muted-foreground hover:text-foreground focus:ring-ring rounded px-2 py-1 text-xs font-medium underline-offset-2 transition-colors hover:underline focus:ring-2 focus:ring-offset-0 focus:outline-none"
      >
        Past 30 days
      </button>
    </div>
  );
}
