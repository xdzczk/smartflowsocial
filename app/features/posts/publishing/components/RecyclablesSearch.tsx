import { Search } from "lucide-react";

import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

interface RecyclablesSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

/**
 * Search input component for recyclables posts
 */
export function RecyclablesSearch({
  searchTerm,
  onSearchChange,
}: RecyclablesSearchProps) {
  return (
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
  );
}
