/**
 * Date range filter for Scheduled and Published pages.
 * Renders From/To date inputs and an optional Clear action.
 */

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

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
}

export function DateRangeFilter({
  dateRange,
  onDateRangeChange,
  idPrefix = "date",
  className,
}: DateRangeFilterProps) {
  const hasActiveFilter = Boolean(dateRange.from || dateRange.to);

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}
      role="group"
      aria-label="Filter by date range"
    >
      <div className="flex items-center gap-2">
        <Label
          htmlFor={`${idPrefix}-from`}
          className="text-muted-foreground text-sm whitespace-nowrap"
        >
          From
        </Label>
        <Input
          type="date"
          id={`${idPrefix}-from`}
          value={dateRange.from}
          onChange={(e) =>
            onDateRangeChange({ ...dateRange, from: e.target.value })
          }
          className="h-9 w-auto min-w-[8rem]"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label
          htmlFor={`${idPrefix}-to`}
          className="text-muted-foreground text-sm whitespace-nowrap"
        >
          To
        </Label>
        <Input
          type="date"
          id={`${idPrefix}-to`}
          value={dateRange.to}
          onChange={(e) =>
            onDateRangeChange({ ...dateRange, to: e.target.value })
          }
          className="h-9 w-auto min-w-[8rem]"
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
