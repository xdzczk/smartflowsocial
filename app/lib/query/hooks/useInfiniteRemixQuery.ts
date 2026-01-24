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

      // Store initial data to detect when new data arrives
      const initialData = fetcher.data;

      // Set the URL we're expecting to load
      loadingUrlRef.current = url;

      // Load the URL - this will trigger a new request
      fetcher.load(url);

      // Wait for fetcher to complete with new data
      return new Promise<TData>((resolve, reject) => {
        let hasSeenLoading = false;
        const maxWaitTime = 10000; // 10 second timeout
        const startTime = Date.now();

        // Helper to verify pagination matches requested page
        const verifyPageData = (data: unknown): boolean => {
          if (
            typeof data === "object" &&
            data !== null &&
            "pagination" in data
          ) {
            const pagination = (data as { pagination?: unknown }).pagination;
            if (
              pagination &&
              typeof pagination === "object" &&
              "currentPage" in pagination &&
              typeof pagination.currentPage === "number"
            ) {
              return pagination.currentPage === pageParam;
            }
          }
          return true; // No pagination to verify, accept data
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

        // Track retry count for stale data
        let retryCount = 0;
        const maxRetries = 5;

        // Helper to handle idle state with data
        const handleIdleWithData = (data: unknown, shouldRetry = false) => {
          if (!data) {
            if (shouldRetry && retryCount < maxRetries) {
              retryCount++;
              setTimeout(checkFetcher, 200);
              return;
            }
            rejectWithCleanup(new Error("No data received from fetcher"));
            return;
          }

          if (verifyPageData(data)) {
            resolveWithCleanup(data as TData);
          } else {
            // Wrong page data - might be stale, retry a few times
            if (shouldRetry && retryCount < maxRetries) {
              retryCount++;
              // Wait a bit longer on each retry
              setTimeout(checkFetcher, 200 * retryCount);
              return;
            }
            // After max retries, accept the data anyway (might be a race condition)
            // This prevents infinite retry loops
            const dataObj = data as {
              pagination?: { currentPage?: number };
            } | null;
            const receivedPage =
              dataObj && "pagination" in dataObj
                ? dataObj.pagination?.currentPage
                : undefined;
            console.warn(
              `Received data for wrong page after ${retryCount} retries, accepting anyway. Requested: ${pageParam}, Got: ${receivedPage ?? "unknown"}`
            );
            resolveWithCleanup(data as TData);
          }
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

          // Once we've seen loading and now idle, verify we got the correct page data
          if (hasSeenLoading && currentState === "idle") {
            handleIdleWithData(currentData, true);
            return;
          }

          // If idle but haven't seen loading yet, wait for loading to start
          if (currentState === "idle" && !hasSeenLoading) {
            // If data changed from initial, loading might have happened very quickly
            if (currentData && currentData !== initialData) {
              // For page 2+, verify the data matches
              if (pageParam > 1) {
                if (verifyPageData(currentData)) {
                  resolveWithCleanup(currentData as TData);
                } else {
                  // Wrong page, wait a bit more
                  setTimeout(checkFetcher, 100);
                }
              } else {
                // Page 1 - accept the data
                resolveWithCleanup(currentData as TData);
              }
            } else {
              // Give it a moment to start loading
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
