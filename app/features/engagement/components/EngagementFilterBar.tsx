/**
 * Filter chips and sort dropdown for engagement feed.
 */

import type { EngagementSortBy } from "../hooks/useEngagementState";

const FILTER_BUTTON_BASE =
  "rounded-full px-3 py-1 text-xs font-medium transition-colors";
const FILTER_ACTIVE = "bg-primary text-primary-foreground";
const FILTER_INACTIVE = "bg-muted text-muted-foreground hover:bg-muted/80";

const SORT_OPTIONS: Array<{ value: EngagementSortBy; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "trust", label: "Trust first" },
  { value: "zaps", label: "High zaps first" },
];

interface EngagementFilterBarProps {
  filterHighReputation: boolean;
  setFilterHighReputation: (v: boolean) => void;
  filterFollowingOnly: boolean;
  setFilterFollowingOnly: (v: boolean) => void;
  sortBy: EngagementSortBy;
  setSortBy: (v: EngagementSortBy) => void;
  filterUnhandledOnly: boolean;
  setFilterUnhandledOnly: (v: boolean) => void;
  filterHasDraft: boolean;
  setFilterHasDraft: (v: boolean) => void;
  filterHasScheduledAction: boolean;
  setFilterHasScheduledAction: (v: boolean) => void;
  includeScheduledInNeedsResponse: boolean;
  setIncludeScheduledInNeedsResponse: (v: boolean) => void;
}

export function EngagementFilterBar({
  filterHighReputation,
  setFilterHighReputation,
  filterFollowingOnly,
  setFilterFollowingOnly,
  sortBy,
  setSortBy,
  filterUnhandledOnly,
  setFilterUnhandledOnly,
  filterHasDraft,
  setFilterHasDraft,
  filterHasScheduledAction,
  setFilterHasScheduledAction,
  includeScheduledInNeedsResponse,
  setIncludeScheduledInNeedsResponse,
}: EngagementFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 md:ml-auto md:flex-shrink-0">
      <span className="text-muted-foreground mr-1 text-xs font-medium">
        Filters:
      </span>
      <button
        type="button"
        onClick={() => setFilterUnhandledOnly(!filterUnhandledOnly)}
        className={`${FILTER_BUTTON_BASE} ${
          filterUnhandledOnly ? FILTER_ACTIVE : FILTER_INACTIVE
        }`}
      >
        Unhandled only
      </button>
      <button
        type="button"
        onClick={() => setFilterHasDraft(!filterHasDraft)}
        className={`${FILTER_BUTTON_BASE} ${
          filterHasDraft ? FILTER_ACTIVE : FILTER_INACTIVE
        }`}
      >
        Has draft
      </button>
      <button
        type="button"
        onClick={() => setFilterHasScheduledAction(!filterHasScheduledAction)}
        className={`${FILTER_BUTTON_BASE} ${
          filterHasScheduledAction ? FILTER_ACTIVE : FILTER_INACTIVE
        }`}
      >
        Has scheduled
      </button>
      <button
        type="button"
        onClick={() =>
          setIncludeScheduledInNeedsResponse(!includeScheduledInNeedsResponse)
        }
        className={`${FILTER_BUTTON_BASE} ${
          includeScheduledInNeedsResponse ? FILTER_ACTIVE : FILTER_INACTIVE
        }`}
      >
        Needs response incl. scheduled
      </button>
      <button
        type="button"
        onClick={() => setFilterFollowingOnly(!filterFollowingOnly)}
        className={`${FILTER_BUTTON_BASE} ${
          filterFollowingOnly ? FILTER_ACTIVE : FILTER_INACTIVE
        }`}
      >
        Following only
      </button>
      <button
        type="button"
        onClick={() => setFilterHighReputation(!filterHighReputation)}
        className={`${FILTER_BUTTON_BASE} ${
          filterHighReputation ? FILTER_ACTIVE : FILTER_INACTIVE
        }`}
      >
        High reputation
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
