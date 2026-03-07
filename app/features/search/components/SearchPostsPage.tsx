import { useFetcher, useLoaderData } from "@remix-run/react";
import { Search } from "lucide-react";

import {
  validateSearchResultData,
  validateSearchResultDisplay,
  validateSearchStats,
} from "~/lib/validation/search-result";

import { useSearchState } from "../hooks/useSearchState";

import { SearchResult } from "./SearchResult";
import { SearchToast } from "./SearchToast";

export default function SearchPostsPage() {
  const loaderData = useLoaderData<{
    user: { timezone?: string | null } | null;
    searchResult?: { event?: unknown; stats?: unknown; error?: string };
  }>();
  const { user, searchResult: loaderSearchResult } = loaderData;
  const fetcher = useFetcher();

  const {
    toast,
    isSearching,
    searchResult,
    searchStats,
    setToast,
    handleScheduleQuote,
    handleScheduleRepost,
    clearSearch,
  } = useSearchState({
    user,
    fetcherData: validateSearchResultData(fetcher.data),
    loaderSearchResult: validateSearchResultData(loaderSearchResult ?? null),
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">
          {searchResult ? "Post" : "Search Posts"}
        </h1>
        <p className="dark:text-muted-foreground text-foreground text-sm">
          {searchResult
            ? "Viewing post from link. Use the search bar above to open another."
            : "Use the search bar above to view a Nostr post or article (note1, nevent1, naddr1, or hex)."}
        </p>
      </div>

      {searchResult ? (
        <SearchResult
          result={
            validateSearchResultDisplay(searchResult) ?? {
              id: "",
              pubkey: "",
              created_at: 0,
              kind: 0,
              content: "",
              tags: [],
              authorName: "",
              authorImage: null,
              mediaUrls: [],
            }
          }
          stats={validateSearchStats(searchStats) ?? null}
          onClear={clearSearch}
          onScheduleQuote={handleScheduleQuote}
          onScheduleRepost={handleScheduleRepost}
        />
      ) : !isSearching ? (
        <div className="dark:border-border dark:bg-card border-border bg-card flex flex-col items-center justify-center rounded-lg border py-12 text-center">
          <Search
            className="text-muted-foreground mb-3 h-12 w-12"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="dark:text-muted-foreground text-muted-foreground text-sm">
            Paste a Nostr link (note1, nevent1, naddr1) in the top search bar to
            view a post or article here.
          </p>
        </div>
      ) : null}

      <SearchToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
