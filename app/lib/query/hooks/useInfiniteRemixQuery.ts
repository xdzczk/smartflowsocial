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

      // Store initial data BEFORE making the request to detect changes
      // We need to capture what the fetcher currently has so we can detect when NEW data arrives
      const initialFetcherData = fetcher.data;
      const initialPaginationPage =
        initialFetcherData &&
        typeof initialFetcherData === "object" &&
        "pagination" in initialFetcherData &&
        initialFetcherData.pagination &&
        typeof initialFetcherData.pagination === "object" &&
        "currentPage" in initialFetcherData.pagination &&
        typeof initialFetcherData.pagination.currentPage === "number"
          ? initialFetcherData.pagination.currentPage
          : null;

      // Create a snapshot of initial data to detect changes
      // Use a simple hash based on pagination and data length
      const initialDataHash = initialFetcherData
        ? JSON.stringify({
            page: initialPaginationPage,
            postsCount:
              typeof initialFetcherData === "object" &&
              "posts" in initialFetcherData &&
              Array.isArray(initialFetcherData["posts"])
                ? initialFetcherData["posts"].length
                : 0,
            longformCount:
              typeof initialFetcherData === "object" &&
              "longformPosts" in initialFetcherData &&
              Array.isArray(initialFetcherData["longformPosts"])
                ? initialFetcherData["longformPosts"].length
                : 0,
          })
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

        // Helper to resolve with cleanup and validation
        const resolveWithCleanup = (data: TData) => {
          loadingUrlRef.current = null;
          // Validate data structure before resolving
          // TData extends PageData which is an object, so we only need to check type
          if (typeof data !== "object") {
            rejectWithCleanup(
              new Error(`Invalid data structure received for page ${pageParam}`)
            );
            return;
          }
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

          // CRITICAL: Verify this is actually NEW data, not the same as initial
          // Check if this is different from what we started with
          const isNewData = data !== initialFetcherData;

          // If pagination exists, verify it matches the requested page
          if (
            currentPaginationPage !== null &&
            currentPaginationPage !== pageParam
          ) {
            console.warn(
              `[useInfiniteRemixQuery] Page mismatch: expected page ${pageParam}, got page ${currentPaginationPage}`
            );
            // Still accept if it's new data (might be a server-side pagination issue)
            if (!isNewData) {
              // This is the same data we started with - reject it
              rejectWithCleanup(
                new Error(
                  `Received same data for page ${pageParam} (got page ${currentPaginationPage})`
                )
              );
              return;
            }
          }

          // If data reference is the same, it's definitely stale
          if (!isNewData && initialFetcherData !== null) {
            console.warn(
              `[useInfiniteRemixQuery] Received same data reference for page ${pageParam}, waiting for new data...`
            );
            // Continue polling - might be a very fast response
            setTimeout(checkFetcher, 100);
            return;
          }

          // Accept the data since we've seen the loading transition and it's new
          console.info(
            `[useInfiniteRemixQuery] Successfully loaded page ${pageParam} (detected page ${currentPaginationPage ?? "unknown"})`
          );
          resolveWithCleanup(data);
        };

        // Handle case where idle but haven't seen loading (cached or fast response)
        const handleIdleWithoutLoading = (
          data: TData,
          elapsed: number
        ): boolean => {
          const currentPaginationPage = getPaginationPage(data);

          // CRITICAL: Check if this is actually different data
          const isNewData = data !== initialFetcherData;

          // If data reference is the same, it's definitely stale
          if (!isNewData && initialFetcherData !== null) {
            // Same data reference - not new data yet
            return false;
          }

          // Create hash of current data to compare with initial
          const currentDataHash = JSON.stringify({
            page: currentPaginationPage,
            postsCount:
              typeof data === "object" &&
              "posts" in data &&
              Array.isArray(data["posts"])
                ? data["posts"].length
                : 0,
            longformCount:
              typeof data === "object" &&
              "longformPosts" in data &&
              Array.isArray(data["longformPosts"])
                ? data["longformPosts"].length
                : 0,
          });

          // If data hash changed AND it's a new data reference, this is new data
          if (currentDataHash !== initialDataHash && isNewData) {
            // Verify it's for the right page
            if (
              currentPaginationPage === pageParam ||
              currentPaginationPage === null
            ) {
              console.info(
                `[useInfiniteRemixQuery] Fast response detected for page ${pageParam} (detected page ${currentPaginationPage ?? "unknown"})`
              );
              resolveWithCleanup(data);
              return true;
            }
          }

          // If page number changed from initial, this is definitely new data
          if (
            currentPaginationPage !== null &&
            currentPaginationPage !== initialPaginationPage &&
            isNewData
          ) {
            console.info(
              `[useInfiniteRemixQuery] Page changed from ${initialPaginationPage ?? "unknown"} to ${currentPaginationPage ?? "unknown"} for request ${pageParam}`
            );
            resolveWithCleanup(data);
            return true;
          }

          // If page is the same as requested and different from initial, accept it
          if (
            currentPaginationPage === pageParam &&
            currentPaginationPage !== initialPaginationPage &&
            isNewData
          ) {
            console.info(
              `[useInfiniteRemixQuery] Page ${pageParam} loaded (was ${initialPaginationPage ?? "unknown"})`
            );
            resolveWithCleanup(data);
            return true;
          }

          // If we've waited a while and still no loading state, might be cached
          // Accept the data if it's for the right page and data changed
          if (
            elapsed > 500 &&
            currentPaginationPage === pageParam &&
            currentDataHash !== initialDataHash &&
            isNewData
          ) {
            console.info(
              `[useInfiniteRemixQuery] Accepting cached response for page ${pageParam} after ${elapsed}ms`
            );
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
            // Reset data check - we're now loading, so any data we see after this should be new
            setTimeout(checkFetcher, 50);
            return;
          }

          // Once we've seen loading and now idle, we have new data
          if (hasSeenLoading && currentState === "idle") {
            if (!currentData) {
              rejectWithCleanup(new Error("No data received from fetcher"));
              return;
            }
            handleLoadingComplete(currentData as TData);
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

            if (!handleIdleWithoutLoading(currentData as TData, elapsed)) {
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
