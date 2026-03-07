/**
 * Filter chips and sort dropdown for engagement feed.
 */

import type { EngagementSortBy } from "../hooks/useEngagementState";

const SORT_OPTIONS: Array<{ value: EngagementSortBy; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "trust", label: "Trust first" },
  { value: "zaps", label: "High zaps first" },
];

interface EngagementFilterBarProps {
  filterHighReputation: boolean;
  setFilterHighReputation: (v: boolean) => void;
  filterMentionsOnly: boolean;
  setFilterMentionsOnly: (v: boolean) => void;
  sortBy: EngagementSortBy;
  setSortBy: (v: EngagementSortBy) => void;
}

export function EngagementFilterBar({
  filterHighReputation,
  setFilterHighReputation,
  filterMentionsOnly,
  setFilterMentionsOnly,
  sortBy,
  setSortBy,
}: EngagementFilterBarProps) {
  return (
    <div className="border-border mb-4 flex flex-wrap items-center gap-2 border-b pb-3">
      <span className="text-muted-foreground mr-1 text-xs font-medium">
        Filters:
      </span>
      <button
        type="button"
        onClick={() => setFilterHighReputation(!filterHighReputation)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          filterHighReputation
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        High reputation
      </button>
      <button
        type="button"
        onClick={() => setFilterMentionsOnly(!filterMentionsOnly)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          filterMentionsOnly
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        Mentions only
      </button>
      <span className="text-muted-foreground border-border ml-2 border-l pl-2 text-xs font-medium">
        Sort:
      </span>
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as EngagementSortBy)}
        className="bg-muted border-border text-foreground rounded-lg border px-2 py-1 text-xs"
        aria-label="Sort order"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
