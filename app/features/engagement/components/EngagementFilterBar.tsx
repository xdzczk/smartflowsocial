/**
 * Filter chips and sort dropdown for engagement feed.
 */

import { ChevronDown } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

import type { EngagementSortBy } from "../engagement-filter";

const FILTER_BUTTON_BASE =
  "rounded-full px-3 py-1 text-xs font-medium motion-fast";
const FILTER_ACTIVE = "bg-brand text-brand-on";
const FILTER_INACTIVE =
  "bg-surface-hover text-text-secondary hover:bg-surface-hover/80";

const SORT_OPTIONS: Array<{ value: EngagementSortBy; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "trust", label: "Highest priority" },
  { value: "most_engaged", label: "Most engaged" },
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
  const moreFiltersActive =
    filterHasDraft ||
    filterHasScheduledAction ||
    includeScheduledInNeedsResponse;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 md:ml-auto md:flex-shrink-0">
      <span className="sr-only">Filters</span>
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`h-8 gap-1 text-xs ${
              moreFiltersActive ? "border-brand/50" : ""
            }`}
          >
            More filters
            <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuCheckboxItem
            checked={filterHasDraft}
            onCheckedChange={(v) => setFilterHasDraft(v === true)}
          >
            Has draft
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={filterHasScheduledAction}
            onCheckedChange={(v) => setFilterHasScheduledAction(v === true)}
          >
            Has scheduled
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={includeScheduledInNeedsResponse}
            onCheckedChange={(v) =>
              setIncludeScheduledInNeedsResponse(v === true)
            }
          >
            Needs response incl. scheduled
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-text-secondary border-border ml-1 border-l pl-2 text-xs font-medium">
        Sort
      </span>
      <select
        data-testid="engagement-sort"
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as EngagementSortBy)}
        className="bg-surface-hover border-border text-text rounded-lg border px-2 py-1 text-xs"
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
