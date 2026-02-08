/**
 * TanStack Query infinite query integration with Remix loaders
 * Allows using Remix loader data with React Query's useInfiniteQuery for infinite scroll
 */

import { useInfiniteQuery } from "@tanstack/react-query";

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
  // NOTE: We use fetch() directly instead of fetcher.load() because fetcher.load()
  // doesn't work reliably in Promise contexts (the fetcher state doesn't update properly)
  // const fetcher = useFetcher<TData>(); // Not needed anymore - using fetch() directly

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
      let url = buildUrl
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

      // CRITICAL: Add _data parameter to get JSON response instead of HTML
      // Remix returns HTML by default, but _data parameter tells it to return JSON
      // The route ID format matches the file structure:
      // /dashboard -> routes/dashboard
      // /dashboard/scheduled -> routes/dashboard.scheduled
      // /dashboard/published -> routes/dashboard.published
      if (typeof window !== "undefined") {
        try {
          // Handle both absolute and relative URLs
          const baseUrl = url.startsWith("http")
            ? url
            : window.location.origin + url;
          const urlObj = new URL(baseUrl);

          // Only add _data if not already present
          if (!urlObj.searchParams.has("_data")) {
            const pathname = urlObj.pathname;

            // Convert pathname to Remix route ID format
            // Remove leading slash and replace remaining slashes with dots
            let routeId = pathname
              .replace(/^\//, "") // Remove leading slash
              .replace(/\//g, "."); // Replace slashes with dots

            // Handle special case: /dashboard -> routes/dashboard._index
            // (Remix uses dashboard._index.tsx for the /dashboard route)
            if (routeId === "dashboard" || routeId === "") {
              routeId = "routes/dashboard._index";
            } else {
              // Prepend "routes/" to match Remix route ID format
              routeId = `routes/${routeId}`;
            }

            urlObj.searchParams.set("_data", routeId);
            // Return relative URL (pathname + search)
            url = urlObj.pathname + urlObj.search;
          }
        } catch {
          // If URL parsing fails, continue (might be a relative URL)
          // Silently continue - URL might still work without _data parameter
        }
      }

      // CRITICAL FIX: Use fetch directly instead of fetcher.load()
      // fetcher.load() doesn't work reliably in Promise contexts - the fetcher state
      // doesn't update properly when called from within a queryFn Promise
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return (await response.json()) as TData;
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
