import { useMemo } from "react";

import { cn } from "~/lib/utils";

import { formatDateOnlyForDisplay } from "../../utils/date-range-filter";
import type { DateFormatKey, DateRangeValue } from "../DateRangeFilter";

import { FilterDateField } from "./FilterDateField";

export function FilterDateRangeControls({
  dateRange,
  onDateRangeChange,
  idPrefix = "date",
  minDate,
  maxDate,
  userDateFormat,
  className,
  showClear = true,
}: {
  dateRange: DateRangeValue;
  onDateRangeChange: (range: DateRangeValue) => void;
  idPrefix?: string;
  minDate?: string;
  maxDate?: string;
  userDateFormat?: DateFormatKey | null;
  className?: string;
  showClear?: boolean;
}) {
  const hasActiveFilter = Boolean(dateRange.from || dateRange.to);

  const formattedRangeLabel = useMemo(() => {
    if (!userDateFormat || !dateRange.from || !dateRange.to) return null;
    return `${formatDateOnlyForDisplay(dateRange.from, userDateFormat)} – ${formatDateOnlyForDisplay(dateRange.to, userDateFormat)}`;
  }, [dateRange.from, dateRange.to, userDateFormat]);

  const clampDate = (value: string): string => {
    if (!value) return value;
    if (minDate && value < minDate) return minDate;
    if (maxDate && value > maxDate) return maxDate;
    return value;
  };

  return (
    <div
      className={cn("flex flex-wrap items-center gap-3", className)}
      role="group"
      aria-label="Filter by date range"
    >
      <FilterDateField
        id={`${idPrefix}-from`}
        label="From"
        value={dateRange.from}
        onValueChange={(next) =>
          onDateRangeChange({ ...dateRange, from: clampDate(next) })
        }
        min={minDate}
        max={maxDate}
      />
      <FilterDateField
        id={`${idPrefix}-to`}
        label="To"
        value={dateRange.to}
        onValueChange={(next) =>
          onDateRangeChange({ ...dateRange, to: clampDate(next) })
        }
        min={minDate}
        max={maxDate}
      />

      {formattedRangeLabel ? (
        <span className="text-text-secondary text-xs" aria-hidden>
          {formattedRangeLabel}
        </span>
      ) : null}

      {showClear && hasActiveFilter ? (
        <button
          type="button"
          onClick={() => onDateRangeChange({ from: "", to: "" })}
          className="focus-ring text-text-secondary hover:text-text rounded-md px-2 py-1 text-xs font-medium underline-offset-2 hover:underline"
        >
          Clear dates
        </button>
      ) : null}
    </div>
  );
}
