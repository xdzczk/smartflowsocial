/**
 * Date range filter for Scheduled and Published pages.
 * Renders From/To date inputs and an optional Clear action.
 */

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import {
  DESKTOP_FILTER_INPUT_CLASS,
  DESKTOP_FILTER_LABEL_CLASS,
  MOBILE_FILTER_INPUT_CLASS,
  MOBILE_FILTER_LABEL_CLASS,
} from "./constants";

export interface DateRangeValue {
  from: string;
  to: string;
}

interface DateRangeFilterProps {
  dateRange: DateRangeValue;
  onDateRangeChange: (range: DateRangeValue) => void;
  /** Optional id prefix for a11y (e.g. "scheduled", "published") */
  idPrefix?: string;
  className?: string;
  /** Optional min date (YYYY-MM-DD). E.g. for Scheduled: only allow today and future. */
  minDate?: string;
  /** Optional max date (YYYY-MM-DD). E.g. for Published: only allow past and today. */
  maxDate?: string;
}

export function DateRangeFilter({
  dateRange,
  onDateRangeChange,
  idPrefix = "date",
  className,
  minDate,
  maxDate,
}: DateRangeFilterProps) {
  const hasActiveFilter = Boolean(dateRange.from || dateRange.to);

  const clampDate = (value: string): string => {
    if (!value) return value;
    if (minDate && value < minDate) return minDate;
    if (maxDate && value > maxDate) return maxDate;
    return value;
  };

  const handleFromChange = (value: string) => {
    onDateRangeChange({ ...dateRange, from: clampDate(value) });
  };

  const handleToChange = (value: string) => {
    onDateRangeChange({ ...dateRange, to: clampDate(value) });
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}
      role="group"
      aria-label="Filter by date range"
    >
      <div className="flex items-center gap-2">
        <Label
          htmlFor={`${idPrefix}-from`}
          className={`text-muted-foreground text-sm whitespace-nowrap ${MOBILE_FILTER_LABEL_CLASS} ${DESKTOP_FILTER_LABEL_CLASS}`}
        >
          From
        </Label>
        <Input
          type="date"
          id={`${idPrefix}-from`}
          value={dateRange.from}
          onChange={(e) => handleFromChange(e.target.value)}
          className={`h-8 w-auto min-w-[8rem] ${MOBILE_FILTER_INPUT_CLASS} ${DESKTOP_FILTER_INPUT_CLASS}`}
          min={minDate}
          max={maxDate}
        />
      </div>
      <div className="flex items-center gap-2">
        <Label
          htmlFor={`${idPrefix}-to`}
          className={`text-muted-foreground text-sm whitespace-nowrap ${MOBILE_FILTER_LABEL_CLASS} ${DESKTOP_FILTER_LABEL_CLASS}`}
        >
          To
        </Label>
        <Input
          type="date"
          id={`${idPrefix}-to`}
          value={dateRange.to}
          onChange={(e) => handleToChange(e.target.value)}
          className={`h-8 w-auto min-w-[8rem] ${MOBILE_FILTER_INPUT_CLASS} ${DESKTOP_FILTER_INPUT_CLASS}`}
          min={minDate}
          max={maxDate}
        />
      </div>
      {hasActiveFilter ? (
        <button
          type="button"
          onClick={() => onDateRangeChange({ from: "", to: "" })}
          className="text-primary hover:text-primary/80 focus:ring-ring rounded text-sm underline focus:ring-2 focus:outline-none"
        >
          Clear dates
        </button>
      ) : null}
    </div>
  );
}
