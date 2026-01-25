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
  // Track when we made the request to ensure we only accept data from this specific request
  const requestTimestampRef = useRef<number | null>(null);

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

      // CRITICAL: Store what we expect to see change BEFORE making the request
      // This ensures we can detect when NEW data arrives
      const beforeLoadData = fetcher.data;
      const beforeLoadPage =
        beforeLoadData &&
        typeof beforeLoadData === "object" &&
        "pagination" in beforeLoadData &&
        beforeLoadData.pagination &&
        typeof beforeLoadData.pagination === "object" &&
        "currentPage" in beforeLoadData.pagination &&
        typeof beforeLoadData.pagination.currentPage === "number"
          ? beforeLoadData.pagination.currentPage
          : null;

      // Store initial data for comparison
      // Use the data we captured before calling load()
      const initialFetcherData = beforeLoadData;
      // Use the page we captured before loading
      const initialPaginationPage = beforeLoadPage;

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

      // Record timestamp BEFORE making the request
      // This ensures we only accept data that arrives after this request was made
      const requestTimestamp = Date.now();
      requestTimestampRef.current = requestTimestamp;

      // Load the URL - this will trigger a new request
      fetcher.load(url);

      // Log that we're making the request - use console.error to ensure it shows
      console.error(
        `[useInfiniteRemixQuery] 🔄 REQUESTING page ${pageParam} from ${url} (initial page: ${beforeLoadPage ?? "null"})`
      );

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
          requestTimestampRef.current = null;
          // Validate data structure before resolving
          // TData extends PageData which is an object, so we only need to check type
          if (typeof data !== "object") {
            rejectWithCleanup(
              new Error(`Invalid data structure received for page ${pageParam}`)
            );
            return;
          }

          // Log the resolution with data details for debugging
          const resolvedPage = getPaginationPage(data);
          const postsCount =
            typeof data === "object" &&
            "posts" in data &&
            Array.isArray(data["posts"])
              ? data["posts"].length
              : 0;
          const longformCount =
            typeof data === "object" &&
            "longformPosts" in data &&
            Array.isArray(data["longformPosts"])
              ? data["longformPosts"].length
              : 0;

          // Use console.error to ensure it shows up even if console.info is filtered
          console.error(
            `[useInfiniteRemixQuery] ✅ RESOLVING page ${pageParam} (detected: ${resolvedPage ?? "null"}, posts: ${postsCount}, longform: ${longformCount})`
          );

          resolve(data);
        };

        // Helper to reject with cleanup
        const rejectWithCleanup = (error: Error) => {
          loadingUrlRef.current = null;
          requestTimestampRef.current = null;
          reject(error);
        };

        // Helper to check if data is from this specific request
        const isDataFromThisRequest = (data: TData): boolean => {
          const timeSinceRequest = Date.now() - requestTimestamp;

          // If we haven't waited at least 50ms, this might be stale data from a previous request
          if (timeSinceRequest < 50) {
            return false;
          }

          // If data is different from initial, it's definitely new
          if (data !== initialFetcherData) {
            return true;
          }

          // If it's the same reference, check if page number matches what we requested
          // This handles cases where Remix might return the same object but with updated content
          const currentPage = getPaginationPage(data);
          if (currentPage === pageParam) {
            // Page matches - might be cached but correct, accept it after sufficient wait
            return timeSinceRequest > 200;
          }

          // If page doesn't match and it's the same reference, it's stale
          return false;
        };

        // Handle case where loading completed and we have new data
        const handleLoadingComplete = (data: TData) => {
          const currentPaginationPage = getPaginationPage(data);
          const timeSinceRequest = Date.now() - requestTimestamp;
          const elapsed = Date.now() - startTime;

          // CRITICAL: If we've seen loading transition, this is new data from the server
          // However, we need to ensure it's from THIS request, not a previous one
          if (timeSinceRequest < 50) {
            // Too soon - might be stale, wait a bit more
            setTimeout(checkFetcher, 100);
            return;
          }

          // If data reference is different, it's definitely new
          const isNewData = data !== initialFetcherData;

          // If page number changed from initial, it's definitely new data
          const pageChanged =
            currentPaginationPage !== null &&
            currentPaginationPage !== initialPaginationPage;

          // ULTRA-SIMPLIFIED: If page number matches, accept it immediately
          // This is the most reliable check - if server says it's page 2, it's page 2
          if (currentPaginationPage === pageParam) {
            console.info(
              `[useInfiniteRemixQuery] Page ${pageParam} confirmed - accepting data (timeSinceRequest: ${timeSinceRequest}ms, elapsed: ${elapsed}ms)`
            );
            resolveWithCleanup(data);
            return;
          }

          // If page changed from initial, it's definitely new data
          if (pageChanged) {
            // currentPaginationPage is guaranteed to be non-null here due to pageChanged check
            const currentPage = currentPaginationPage;
            const initialPage = initialPaginationPage ?? "unknown";
            console.info(
              `[useInfiniteRemixQuery] Page changed from ${initialPage} to ${currentPage} - accepting for request ${pageParam}`
            );
            resolveWithCleanup(data);
            return;
          }

          // If data reference is different and we've waited, accept it
          if (isNewData && elapsed > 200) {
            console.warn(
              `[useInfiniteRemixQuery] Accepting new data reference for page ${pageParam} (detected page ${currentPaginationPage ?? "unknown"}) after ${elapsed}ms`
            );
            resolveWithCleanup(data);
            return;
          }

          // If we've waited a while and page matches, accept it (handles cached responses)
          if (elapsed > 500 && currentPaginationPage === pageParam) {
            console.info(
              `[useInfiniteRemixQuery] Accepting data for page ${pageParam} after ${elapsed}ms (cached response)`
            );
            resolveWithCleanup(data);
            return;
          }

          // If we've waited too long and still don't have valid data, reject
          if (elapsed > 5000) {
            rejectWithCleanup(
              new Error(
                `Failed to get valid data for page ${pageParam} after ${elapsed}ms (got page ${currentPaginationPage ?? "unknown"}, isNewData: ${isNewData}, initialPage: ${initialPaginationPage ?? "unknown"})`
              )
            );
            return;
          }

          // Wait a bit more and check again
          setTimeout(checkFetcher, 100);
        };

        // Handle case where idle but haven't seen loading (cached or fast response)
        const handleIdleWithoutLoading = (
          data: TData,
          elapsed: number
        ): boolean => {
          const currentPaginationPage = getPaginationPage(data);

          // CRITICAL: First verify this data is from THIS request
          if (!isDataFromThisRequest(data)) {
            // This is stale data from a previous request - ignore it
            return false;
          }

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
            // currentPaginationPage is guaranteed to be non-null here due to the check above
            const currentPage = currentPaginationPage;
            const initialPage = initialPaginationPage ?? "unknown";
            console.info(
              `[useInfiniteRemixQuery] Page changed from ${initialPage} to ${currentPage} for request ${pageParam}`
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

            // CRITICAL: Verify this data is from our request
            // If we haven't waited at least 50ms since making the request, this might be stale
            const timeSinceRequest = Date.now() - requestTimestamp;
            if (timeSinceRequest < 50) {
              // Too soon - might be stale data, wait a bit more
              setTimeout(checkFetcher, 100);
              return;
            }

            // Check page number - if it matches, accept immediately
            const currentPage = getPaginationPage(currentData);
            if (currentPage === pageParam) {
              console.info(
                `[useInfiniteRemixQuery] Page ${pageParam} loaded successfully (after loading transition, ${timeSinceRequest}ms)`
              );
              resolveWithCleanup(currentData as TData);
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

            // CRITICAL: Ensure we've waited at least 50ms since making the request
            // This prevents accepting stale data from previous requests
            const timeSinceRequest = Date.now() - requestTimestamp;
            if (timeSinceRequest < 50) {
              // Too soon - wait for the request to actually complete
              setTimeout(checkFetcher, 100);
              return;
            }

            // Check page number first - if it matches, accept immediately
            const currentPage = getPaginationPage(currentData);
            if (currentPage === pageParam) {
              console.info(
                `[useInfiniteRemixQuery] Page ${pageParam} loaded successfully (fast/cached response, ${timeSinceRequest}ms)`
              );
              resolveWithCleanup(currentData as TData);
              return;
            }

            if (!handleIdleWithoutLoading(currentData as TData, elapsed)) {
              // Otherwise, give it a moment to start loading
              setTimeout(checkFetcher, 100);
            }
            return;
          }

          // Final fallback: If we've waited long enough, accept data if it's different
          // This ensures we don't get stuck waiting forever
          if (elapsed > 1000 && currentData) {
            const currentPage = getPaginationPage(currentData);
            const isNewData = currentData !== initialFetcherData;

            // If page matches, accept it
            if (currentPage === pageParam) {
              console.info(
                `[useInfiniteRemixQuery] Accepting page ${pageParam} after ${elapsed}ms (fallback - page matches)`
              );
              resolveWithCleanup(currentData as TData);
              return;
            }

            // If data is new and we've waited long enough, accept it (might be server pagination issue)
            if (isNewData && elapsed > 2000) {
              console.warn(
                `[useInfiniteRemixQuery] Accepting new data for page ${pageParam} after ${elapsed}ms despite page mismatch (got page ${currentPage ?? "unknown"})`
              );
              resolveWithCleanup(currentData as TData);
              return;
            }
          }

          // Continue polling
          setTimeout(checkFetcher, 50);
        };

        // Start checking immediately
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
