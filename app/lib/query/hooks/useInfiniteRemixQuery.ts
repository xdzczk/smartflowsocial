/**
 * TanStack Query infinite query integration with Remix loaders
 * Allows using Remix loader data with React Query's useInfiniteQuery for infinite scroll
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";

import { pathnameToRemixDataRouteId } from "~/lib/query/remix-data-route-id";

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
 * import { getNextPageParamFromPaginationTotals } from "~/lib/query/infinite-remix-pagination";
 * const loaderData = useLoaderData();
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteRemixQuery({
 *   queryKey: ["recyclables"],
 *   initialData: loaderData,
 *   getNextPageParam: (lastPage, allPages) =>
 *     getNextPageParamFromPaginationTotals(lastPage, allPages),
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
  maxPages,
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
  refetchInterval?: number | false;
  refetchIntervalInBackground?: boolean;
}) {
  // NOTE: We use fetch() directly instead of fetcher.load() because fetcher.load()
  // doesn't work reliably in Promise contexts (the fetcher state doesn't update properly)
  // const fetcher = useFetcher<TData>(); // Not needed anymore - using fetch() directly

  // Wrap getNextPageParam to respect maxPages limit when set (undefined/Infinity = no cap)
  const capped = typeof maxPages === "number" && Number.isFinite(maxPages);
  const wrappedGetNextPageParam = (
    lastPage: TData,
    allPages: TData[]
  ): number | undefined => {
    if (capped && allPages.length >= maxPages) {
      return undefined;
    }
    const next = getNextPageParam(lastPage, allPages);
    if (typeof window !== "undefined") {
      const raw = lastPage as Record<string, unknown>;
      if (typeof raw["pagination"] === "object") {
        const pg =
          (raw["pagination"] as {
            pages?: number;
            total?: number;
          } | null) ?? {};
        const lp =
          (raw["longformPagination"] as {
            pages?: number;
            total?: number;
          } | null) ?? {};
        // Temporary trace: remove once infinite-scroll is stable
        console.warn("[inf-scroll] getNextPageParam", {
          loadedPages: allPages.length,
          postPages: pg.pages,
          postTotal: pg.total,
          lfPages: lp.pages,
          lfTotal: lp.total,
          next,
        });
      }
    }
    return next;
  };

  // Mark initial data as fresh *now* so TanStack Query respects staleTime.
  // Without this, initialData is treated as updated at epoch 0 (always stale),
  // causing immediate refetches that race with fetchNextPage and reset pages.
  const [mountedAt] = useState(() => Date.now());

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
            const routeId = pathnameToRemixDataRouteId(urlObj.pathname);
            urlObj.searchParams.set("_data", routeId);
            // Return relative URL (pathname + search)
            url = urlObj.pathname + urlObj.search;
          }
        } catch {
          // If URL parsing fails, continue (might be a relative URL)
          // Silently continue - URL might still work without _data parameter
        }
      }

      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      let parsed: TData;
      try {
        parsed = JSON.parse(text) as TData;
      } catch {
        console.error("[inf-scroll] queryFn JSON parse failed", {
          pageParam,
          status: response.status,
          contentType: response.headers.get("content-type"),
          bodyPreview: text.slice(0, 200),
        });
        throw new Error(`Invalid JSON from loader (page ${String(pageParam)})`);
      }

      if (typeof window !== "undefined") {
        const raw = parsed as Record<string, unknown>;
        console.warn("[inf-scroll] queryFn resolved", {
          pageParam,
          hasPosts: Array.isArray(raw["posts"]),
          postCount: Array.isArray(raw["posts"])
            ? (raw["posts"] as unknown[]).length
            : 0,
          hasPagination: typeof raw["pagination"] === "object",
        });
      }

      return parsed;
    },
    initialPageParam: 1,
    getNextPageParam: wrappedGetNextPageParam,
    initialData: {
      pages: [initialData],
      pageParams: [1],
    },
    initialDataUpdatedAt: mountedAt,
    enabled,
    staleTime,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    ...(capped ? { maxPages } : {}),
    refetchInterval,
    refetchIntervalInBackground,
  });
}
