import { useFetcher, useLoaderData } from "@remix-run/react";

import {
  validateSearchResultData,
  validateSearchResultDisplay,
  validateSearchStats,
} from "~/lib/validation/search-result";

import { useSearchState } from "../hooks/useSearchState";

import { SearchForm } from "./SearchForm";
import { SearchResult } from "./SearchResult";
import { SearchToast } from "./SearchToast";

export default function SearchPostsPage() {
  const { user } = useLoaderData<{
    user: { timezone?: string | null } | null;
  }>();
  const fetcher = useFetcher();

  const {
    form,
    eventInput: _eventInput,
    toast,
    isSearching,
    searchResult,
    searchStats,
    setToast,
    handleSearch,
    handleScheduleQuote,
    handleScheduleRepost,
    clearSearch,
  } = useSearchState({
    user,
    fetcherData: validateSearchResultData(fetcher.data),
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">Search Posts</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Search for any Nostr post by event ID, note1, or nevent1 format
        </p>
      </div>

      <SearchForm
        form={form}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSearch(e);
        }}
        isSearching={isSearching}
      />

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
      ) : null}

      <SearchToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
