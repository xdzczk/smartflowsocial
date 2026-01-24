/**
 * TanStack Query infinite query integration with Remix loaders
 * Allows using Remix loader data with React Query's useInfiniteQuery for infinite scroll
 */

import { useFetcher } from "@remix-run/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRef } from "react";

// PageData is a flexible type that allows any data structure
// Some loaders have pagination, others don't - we make it optional
interface PageData {
  pagination?: {
    currentPage?: number;
    totalPages?: number;
    total?: number;
    pages?: number;
  };
  [key: string]: unknown; // Allow any additional properties
}

/**
 * Hook to use Remix loader data with TanStack Query's infinite query
 * Useful for infinite scroll implementations
 *
 * @example
 * ```tsx
 * const loaderData = useLoaderData();
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteRemixQuery({
 *   queryKey: ['recyclables'],
 *   initialData: loaderData,
 *   getNextPageParam: (lastPage) => {
 *     const { pagination } = lastPage;
 *     if (pagination && pagination.currentPage < pagination.totalPages) {
 *       return pagination.currentPage + 1;
 *     }
 *     return undefined;
 *   },
 * });
 * ```
 */
export function useInfiniteRemixQuery<TData extends PageData = PageData>({
  queryKey,
  initialData,
  getNextPageParam,
  enabled = true,
  staleTime,
  buildUrl,
  maxPages = 10,
  placeholderData,
  refetchInterval,
  refetchIntervalInBackground,
}: {
  queryKey: readonly unknown[] | unknown[];
  initialData: TData;
  getNextPageParam: (lastPage: TData, allPages: TData[]) => number | undefined;
  enabled?: boolean;
  staleTime?: number;
  buildUrl?: (pageParam: number) => string;
  maxPages?: number;
  placeholderData?: (
    previousData: { pages: TData[]; pageParams: number[] } | undefined
  ) => { pages: TData[]; pageParams: number[] } | undefined;
  refetchInterval?: number | false;
  refetchIntervalInBackground?: boolean;
}) {
  const fetcher = useFetcher<TData>();
  // Track the URL we're currently loading to verify we get the right response
  const loadingUrlRef = useRef<string | null>(null);

  // Wrap getNextPageParam to respect maxPages limit
  const wrappedGetNextPageParam = (
    lastPage: TData,
    allPages: TData[]
  ): number | undefined => {
    // Check maxPages limit first
    if (allPages.length >= maxPages) {
      return undefined;
    }
    // Then call original getNextPageParam
    return getNextPageParam(lastPage, allPages);
  };

  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 1 }) => {
      // Build URL with page parameter
      const url = buildUrl
        ? buildUrl(pageParam)
        : (() => {
            if (typeof window === "undefined") {
              return `?page=${pageParam}`;
            }
            const location = window.location;
            const search = location.search;
            const pathname = location.pathname;
            const cleanSearch =
              search.split("&page=")[0]?.split("?page=")[0] ?? "";
            const separator = search.includes("?") ? "&" : "?";
            return `${pathname}${cleanSearch}${separator}page=${String(pageParam)}`;
          })();

      if (!url) {
        return Promise.reject(new Error("No URL provided"));
      }

      // Wait for fetcher to be idle before starting new request (avoid race conditions)
      // If fetcher is already loading, wait for it to complete first
      const currentFetcherState = fetcher.state;
      if (currentFetcherState !== "idle") {
        // Wait for current request to finish before starting new one
        await new Promise<void>((resolve) => {
          const checkState = () => {
            const state: string = fetcher.state;
            if (state === "idle") {
              resolve();
            } else {
              setTimeout(checkState, 50);
            }
          };
          checkState();
        });
      }

      // Store initial pagination page to detect when new data arrives
      const initialPaginationPage =
        fetcher.data &&
        typeof fetcher.data === "object" &&
        "pagination" in fetcher.data &&
        fetcher.data.pagination &&
        typeof fetcher.data.pagination === "object" &&
        "currentPage" in fetcher.data.pagination &&
        typeof fetcher.data.pagination.currentPage === "number"
          ? fetcher.data.pagination.currentPage
          : null;

      // Set the URL we're expecting to load
      loadingUrlRef.current = url;

      // Load the URL - this will trigger a new request
      fetcher.load(url);

      // Wait for fetcher to complete with new data
      return new Promise<TData>((resolve, reject) => {
        let hasSeenLoading = false;
        const maxWaitTime = 10000; // 10 second timeout
        const startTime = Date.now();

        // Helper to extract pagination page from data
        const getPaginationPage = (data: unknown): number | null => {
          if (
            data &&
            typeof data === "object" &&
            "pagination" in data &&
            data.pagination &&
            typeof data.pagination === "object" &&
            "currentPage" in data.pagination &&
            typeof data.pagination.currentPage === "number"
          ) {
            return data.pagination.currentPage;
          }
          return null;
        };

        // Helper to resolve with cleanup
        const resolveWithCleanup = (data: TData) => {
          loadingUrlRef.current = null;
          resolve(data);
        };

        // Helper to reject with cleanup
        const rejectWithCleanup = (error: Error) => {
          loadingUrlRef.current = null;
          reject(error);
        };

        // Handle case where loading completed and we have new data
        const handleLoadingComplete = (data: TData) => {
          const currentPaginationPage = getPaginationPage(data);

          // If pagination exists, verify it matches (but don't reject if it doesn't - might be edge case)
          if (
            currentPaginationPage !== null &&
            currentPaginationPage !== pageParam
          ) {
            console.warn(
              `Page mismatch: expected page ${pageParam}, got page ${currentPaginationPage}, but accepting data since loading completed`
            );
          }

          // Accept the data since we've seen the loading transition
          resolveWithCleanup(data);
        };

        // Handle case where idle but haven't seen loading (cached or fast response)
        const handleIdleWithoutLoading = (
          data: TData,
          elapsed: number
        ): boolean => {
          const currentPaginationPage = getPaginationPage(data);

          // If page number changed, this is definitely new data
          if (
            currentPaginationPage !== null &&
            currentPaginationPage !== initialPaginationPage
          ) {
            resolveWithCleanup(data);
            return true;
          }

          // If page is the same as requested and different from initial, accept it
          if (
            currentPaginationPage === pageParam &&
            currentPaginationPage !== initialPaginationPage
          ) {
            resolveWithCleanup(data);
            return true;
          }

          // If we've waited a while and still no loading state, might be cached
          // Accept the data if it's for the right page
          if (elapsed > 500 && currentPaginationPage === pageParam) {
            resolveWithCleanup(data);
            return true;
          }

          return false;
        };

        const checkFetcher = () => {
          const elapsed = Date.now() - startTime;
          if (elapsed > maxWaitTime) {
            rejectWithCleanup(new Error(`Fetcher timeout after ${elapsed}ms`));
            return;
          }

          const currentState = fetcher.state;
          const currentData = fetcher.data;

          // Track when we see loading state (ensures new request started)
          if (currentState === "loading") {
            hasSeenLoading = true;
            setTimeout(checkFetcher, 50);
            return;
          }

          // Once we've seen loading and now idle, we have new data
          if (hasSeenLoading && currentState === "idle") {
            if (!currentData) {
              rejectWithCleanup(new Error("No data received from fetcher"));
              return;
            }
            handleLoadingComplete(currentData);
            return;
          }

          // If idle but haven't seen loading yet, check if data changed
          // This handles cases where loading happened very quickly or data was cached
          if (currentState === "idle" && !hasSeenLoading) {
            if (!currentData) {
              // Give it a moment to start loading
              setTimeout(checkFetcher, 100);
              return;
            }

            if (!handleIdleWithoutLoading(currentData, elapsed)) {
              // Otherwise, give it a moment to start loading
              setTimeout(checkFetcher, 100);
            }
            return;
          }

          // Continue polling
          setTimeout(checkFetcher, 50);
        };
        checkFetcher();
      });
    },
    initialPageParam: 1,
    getNextPageParam: wrappedGetNextPageParam,
    initialData: {
      pages: [initialData],
      pageParams: [1],
    },
    enabled,
    staleTime,
    maxPages,
    placeholderData: placeholderData ?? ((previousData) => previousData),
    refetchInterval,
    refetchIntervalInBackground,
  });
}
