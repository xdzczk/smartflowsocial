import {
  Await,
  useFetcher,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import { Search } from "lucide-react";
import { Suspense } from "react";

import { Badge } from "~/components/ui/badge";
import {
  validateSearchReplies,
  validateSearchResultData,
  validateSearchResultDisplay,
  validateSearchStats,
} from "~/lib/validation/search-result";

import { useSearchState } from "../hooks/useSearchState";

import { LookupErrorPanel } from "./LookupErrorPanel";
import { SearchResult } from "./SearchResult";
import { SearchToast } from "./SearchToast";

/** Shape of `searchResultPromise` from deferred search loader (Remix `Await` does not infer this). */
interface DeferredSearchResult {
  event?: unknown;
  stats?: unknown;
  replies?: unknown;
  resolution?: unknown;
  error?: unknown;
}

export default function SearchPostsPage() {
  const navigation = useNavigation();
  const loaderData = useLoaderData<{
    user: { timezone?: string | null } | null;
    searchResult?: {
      event?: unknown;
      stats?: unknown;
      replies?: unknown;
      resolution?: unknown;
      error?: unknown;
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
    resolution?: unknown;
    error?: unknown;
  } | null;
  forceShowSkeleton: boolean;
}

function SearchPostsPageContent({
  user,
  fetcherData,
  loaderSearchResult,
  forceShowSkeleton,
}: SearchPostsPageContentProps) {
  const [searchParams] = useSearchParams();
  const rawQ = searchParams.get("q")?.trim();
  const queryLabel = rawQ && rawQ.length > 0 ? rawQ : null;
  const revalidator = useRevalidator();

  const {
    toast,
    isSearching,
    searchResult,
    searchStats,
    searchReplies,
    searchLookupError,
    searchResolution,
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

  const hasResult = Boolean(searchResult);
  const showErrorPanel = Boolean(
    queryLabel && searchLookupError && !hasResult && !isSearching
  );

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          Lookup Result
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          {hasResult
            ? "Resolved from pasted identifier. Paste another identifier in the top bar to inspect a different object."
            : "Look up any Nostr object. Paste a note, nevent, naddr, event ID, or supported URL in the global search bar."}
        </p>
      </header>

      {showErrorPanel && searchLookupError ? (
        <LookupErrorPanel
          error={searchLookupError}
          onNewLookup={clearSearch}
          onRetry={() => {
            revalidator.revalidate();
          }}
        />
      ) : null}

      {hasResult ? (
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
          resolution={searchResolution}
          queryLabel={queryLabel}
          onClear={clearSearch}
          onScheduleQuote={handleScheduleQuote}
          onScheduleRepost={handleScheduleRepost}
          onRetryLookup={() => {
            revalidator.revalidate();
          }}
        />
      ) : null}

      {!hasResult && !showErrorPanel && !isSearching && !queryLabel ? (
        <div className="border-border bg-card mx-auto flex max-w-lg flex-col items-center rounded-xl border px-6 py-14 text-center shadow-sm">
          <Search
            className="text-muted-foreground mb-4 h-12 w-12"
            strokeWidth={1.5}
            aria-hidden
          />
          <h2 className="text-foreground text-lg font-semibold">
            Look up any Nostr object
          </h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Paste a note, nevent, naddr, event ID, or supported URL in the top
            search bar to inspect it.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              note1…
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              nevent1…
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              naddr1…
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              hex (64 chars)
            </Badge>
          </div>
        </div>
      ) : null}

      {isSearching && !hasResult ? <SearchPostSkeleton /> : null}

      <SearchToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function SearchPostSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <div className="bg-muted mb-2 h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted h-4 w-full max-w-md animate-pulse rounded" />
      </div>

      <div className="bg-muted mb-6 h-20 w-full animate-pulse rounded-xl" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-sm">
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
            <div className="bg-muted mx-auto h-48 max-w-md animate-pulse rounded-lg" />
          </div>
          <div className="bg-muted h-16 w-full animate-pulse rounded-xl" />
          <div className="bg-muted h-40 w-full animate-pulse rounded-xl" />
        </div>
        <div className="hidden lg:block">
          <div className="border-border bg-card h-72 w-full animate-pulse rounded-xl border shadow-sm" />
        </div>
      </div>
    </div>
  );
}
