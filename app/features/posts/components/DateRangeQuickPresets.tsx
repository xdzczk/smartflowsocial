/**
 * Selectable preset pills for date range:
 * - Scheduled: Next 7 days, Next 30 days
 * - Published/Recyclables: Past 7 days, Past 30 days
 */

import { cn } from "~/lib/utils";

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
  dateRange: DateRangeValue;
  onDateRangeChange: (range: DateRangeValue) => void;
  className?: string;
}

export function DateRangeQuickPresets({
  variant,
  userTimezone,
  dateRange,
  onDateRangeChange,
  className,
}: DateRangeQuickPresetsProps) {
  const tz = userTimezone.trim() || "UTC";

  const presets =
    variant === "future"
      ? [
          {
            id: "next7",
            label: "Next 7 days",
            range: getNext7DaysRange(tz),
          },
          {
            id: "next30",
            label: "Next 30 days",
            range: getNext30DaysRange(tz),
          },
        ]
      : [
          {
            id: "past7",
            label: "Past 7 days",
            range: getPast7DaysRange(tz),
          },
          {
            id: "past30",
            label: "Past 30 days",
            range: getPast30DaysRange(tz),
          },
        ];

  const activePresetId =
    presets.find(
      (p) => p.range.from === dateRange.from && p.range.to === dateRange.to
    )?.id ?? null;

  const basePillClass =
    "focus-visible:ring-focus-ring inline-flex items-center justify-center rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none";

  return (
    <div
      className={cn(
        "flex flex-shrink-0 flex-wrap items-center gap-2",
        className
      )}
      role="group"
      aria-label="Quick date range presets"
    >
      {presets.map((p) => {
        const active = p.id === activePresetId;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (active) {
                onDateRangeChange({ from: "", to: "" });
                return;
              }
              onDateRangeChange(p.range);
            }}
            className={cn(
              basePillClass,
              active
                ? "border-border bg-surface-hover/50 text-text ring-border/60 ring-1 ring-inset"
                : "border-border/60 bg-surface-hover/20 text-text-secondary hover:bg-surface-hover/30 hover:text-text"
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
