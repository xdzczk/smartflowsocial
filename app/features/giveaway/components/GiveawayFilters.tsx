/**
 * Filters component for giveaway posts
 * Includes search and date range filters
 */

import { Search } from "lucide-react";

import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

interface GiveawayFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  dateRange: { from: string; to: string };
  onDateRangeChange: (range: { from: string; to: string }) => void;
  onClearFilters: () => void;
}

export function GiveawayFilters({
  searchTerm,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  onClearFilters,
}: GiveawayFiltersProps) {
  const hasActiveFilters = dateRange.from || dateRange.to || searchTerm;

  return (
    <div className="mt-5 mb-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <div>
        <h3 className="mb-1 font-semibold">Top posts</h3>
      </div>
      <div className="stack-tight sm:flex-row sm:items-center">
        {/* Date range filters */}
        <div className="stack-tight sm:flex-row">
          <div className="cluster">
            <label htmlFor="from-date" className="text-sm whitespace-nowrap">
              From:
            </label>
            <input
              type="date"
              id="from-date"
              name="from-date"
              value={dateRange.from}
              onChange={(e) =>
                onDateRangeChange({ ...dateRange, from: e.target.value })
              }
              className="border-border bg-canvas text-text focus:border-brand focus-visible:ring-focus-ring/50 rounded-lg border px-3 py-2 text-sm leading-6 focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>
          <div className="cluster">
            <label htmlFor="to-date" className="text-sm whitespace-nowrap">
              To:
            </label>
            <input
              type="date"
              id="to-date"
              name="to-date"
              value={dateRange.to}
              onChange={(e) =>
                onDateRangeChange({ ...dateRange, to: e.target.value })
              }
              className="border-border bg-canvas text-text focus:border-brand focus-visible:ring-focus-ring/50 rounded-lg border px-3 py-2 text-sm leading-6 focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full">
          <div className="text-text-secondary pointer-events-none absolute inset-y-0 left-0 my-px ml-px flex w-10 items-center justify-center rounded-l">
            <Search
              className="inline-block size-5"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </div>
          <input
            type="text"
            id="search"
            name="search"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="border-border bg-canvas text-text placeholder:text-text-tertiary focus:border-brand focus-visible:ring-focus-ring/50 block w-full rounded-lg border py-2 pr-3 pl-10 text-sm leading-6 focus-visible:ring-2 focus-visible:outline-none"
            placeholder="Search posts.."
          />
        </div>
      </div>

      {/* Clear filters button */}
      {hasActiveFilters ? (
        <div className="mb-4 flex justify-end">
          <button
            onClick={onClearFilters}
            className="text-brand hover:text-brand/80 text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  );
}
