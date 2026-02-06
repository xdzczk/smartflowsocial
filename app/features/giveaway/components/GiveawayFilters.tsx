/**
 * Filters component for giveaway posts
 * Includes search and date range filters
 */

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Date range filters */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex items-center gap-2">
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
              className="border-border bg-background text-foreground focus:border-primary focus:ring-ring/50 rounded-lg border px-3 py-2 text-sm leading-6 focus:ring focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
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
              className="border-border bg-background text-foreground focus:border-primary focus:ring-ring/50 rounded-lg border px-3 py-2 text-sm leading-6 focus:ring focus:outline-none"
            />
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full">
          <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 my-px ml-px flex w-10 items-center justify-center rounded-l">
            <svg
              className="hi-mini hi-magnifying-glass inline-block size-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <input
            type="text"
            id="search"
            name="search"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/50 block w-full rounded-lg border py-2 pr-3 pl-10 text-sm leading-6 focus:ring focus:outline-none"
            placeholder="Search posts.."
          />
        </div>
      </div>

      {/* Clear filters button */}
      {hasActiveFilters ? (
        <div className="mb-4 flex justify-end">
          <button
            onClick={onClearFilters}
            className="text-primary hover:text-primary/80 text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  );
}
