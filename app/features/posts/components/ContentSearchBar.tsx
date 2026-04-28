import { Search } from "lucide-react";

import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

interface ContentSearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export function ContentSearchBar({
  searchTerm,
  onSearchChange,
}: ContentSearchBarProps) {
  return (
    <div className="cluster mb-4">
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
          className="focus-ring border-border bg-canvas text-text placeholder:text-text-tertiary focus:border-brand block w-full rounded-lg border py-2 pr-3 pl-10 text-sm leading-6"
          placeholder="Search content..."
        />
      </div>
    </div>
  );
}
