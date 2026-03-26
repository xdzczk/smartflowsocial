import {
  Await,
  useFetcher,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { Search } from "lucide-react";
import { Suspense } from "react";

import {
  validateSearchReplies,
  validateSearchResultData,
  validateSearchResultDisplay,
  validateSearchStats,
} from "~/lib/validation/search-result";

import { useSearchState } from "../hooks/useSearchState";

import { SearchResult } from "./SearchResult";
import { SearchToast } from "./SearchToast";

/** Shape of `searchResultPromise` from deferred search loader (Remix `Await` does not infer this). */
interface DeferredSearchResult {
  event?: unknown;
  stats?: unknown;
  replies?: unknown;
  error?: string;
}

export default function SearchPostsPage() {
  const navigation = useNavigation();
  const loaderData = useLoaderData<{
    user: { timezone?: string | null } | null;
    searchResult?: {
      event?: unknown;
      stats?: unknown;
      replies?: unknown;
      error?: string;
    };
    searchResultPromise?: Promise<DeferredSearchResult>;
  }>();
  const {
    user,
    searchResult: loaderSearchResult,
    searchResultPromise,
  } = loaderData;
  const fetcher = useFetcher();

  const isNavigatingToSearchResult =
    navigation.state === "loading" &&
    navigation.location.pathname === "/dashboard/search/posts" &&
    new URLSearchParams(navigation.location.search).get("q") !== null;

  if (searchResultPromise) {
    const deferred = searchResultPromise as Promise<DeferredSearchResult>;
    return (
      <Suspense fallback={<SearchPostSkeleton />}>
        <Await resolve={deferred}>
          {(resolvedSearchResult) => (
            <SearchPostsPageContent
              user={user}
              fetcherData={fetcher.data}
              loaderSearchResult={resolvedSearchResult}
              forceShowSkeleton={isNavigatingToSearchResult}
            />
          )}
        </Await>
      </Suspense>
    );
  }

  return (
    <SearchPostsPageContent
      user={user}
      fetcherData={fetcher.data}
      loaderSearchResult={loaderSearchResult ?? null}
      forceShowSkeleton={isNavigatingToSearchResult}
    />
  );
}

interface SearchPostsPageContentProps {
  user: { timezone?: string | null } | null;
  fetcherData: unknown;
  loaderSearchResult: {
    event?: unknown;
    stats?: unknown;
    replies?: unknown;
    error?: string;
  } | null;
  forceShowSkeleton: boolean;
}

function SearchPostsPageContent({
  user,
  fetcherData,
  loaderSearchResult,
  forceShowSkeleton,
}: SearchPostsPageContentProps) {
  const {
    toast,
    isSearching,
    searchResult,
    searchStats,
    searchReplies,
    setToast,
    handleScheduleQuote,
    handleScheduleRepost,
    clearSearch,
  } = useSearchState({
    user,
    fetcherData: validateSearchResultData(fetcherData),
    loaderSearchResult: validateSearchResultData(loaderSearchResult ?? null),
  });

  if (forceShowSkeleton) {
    return <SearchPostSkeleton />;
  }

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
          replies={validateSearchReplies(searchReplies) ?? []}
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

function SearchPostSkeleton() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="bg-muted mb-2 h-8 w-20 animate-pulse rounded" />
        <div className="bg-muted h-4 w-80 max-w-full animate-pulse rounded" />
      </div>

      <div className="dark:border-border dark:bg-card border-border bg-card space-y-4 rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <div className="bg-muted h-10 w-10 animate-pulse rounded-full" />
          <div className="space-y-2">
            <div className="bg-muted h-4 w-32 animate-pulse rounded" />
            <div className="bg-muted h-3 w-24 animate-pulse rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="bg-muted h-4 w-full animate-pulse rounded" />
          <div className="bg-muted h-4 w-11/12 animate-pulse rounded" />
          <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted h-8 animate-pulse rounded" />
          <div className="bg-muted h-8 animate-pulse rounded" />
          <div className="bg-muted h-8 animate-pulse rounded" />
        </div>
      </div>
    </div>
  );
}
