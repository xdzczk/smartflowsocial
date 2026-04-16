/**
 * Encapsulates infinite scroll sentinel logic: scroll root, two intersection
 * observers (prefetch + fetch), and a single effect that calls fetchNextPage.
 * Use on pages with infinite query lists (Drafts, Posted, Scheduled, Templates).
 *
 * Deduplication relies on TanStack Query: calling `fetchNextPage()` while a
 * page fetch is already in-flight is a no-op (returns the existing promise).
 * This avoids fragile ref-based gating that can desync on Remix re-renders.
 */

import { useEffect, useRef, useState } from "react";

import { useIntersectionObserver } from "./useIntersectionObserver";

interface UseInfiniteScrollSentinelOptions {
  isMobile: boolean;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  isFetching?: boolean;
  loadedPageCount?: number;
  fetchNextPage: () => void;
}

export function useInfiniteScrollSentinel({
  isMobile,
  hasNextPage,
  isFetchingNextPage,
  isFetching,
  loadedPageCount: _loadedPageCount,
  fetchNextPage,
}: UseInfiniteScrollSentinelOptions) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  const root = isMobile ? (scrollRoot ?? undefined) : undefined;

  const rootMargin = "0px 0px 400px 0px";

  const { ref: sentinelRef, isIntersecting } = useIntersectionObserver({
    threshold: 0,
    root,
    rootMargin,
  });

  const { ref: prefetchSentinelRef, isIntersecting: isPrefetchIntersecting } =
    useIntersectionObserver({
      threshold: 0,
      root,
      rootMargin,
    });

  const anyFetching = isFetchingNextPage || (isFetching ?? false);

  // Stable ref so effect closure always calls the latest fetchNextPage.
  const fetchRef = useRef(fetchNextPage);
  useEffect(() => {
    fetchRef.current = fetchNextPage;
  }, [fetchNextPage]);

  // Trigger: when a sentinel is visible, more pages exist, and nothing is
  // fetching, call fetchNextPage.  TanStack Query deduplicates internally so
  // an extra call while a page fetch is already in-flight is harmless.
  useEffect(() => {
    const visible = isIntersecting || isPrefetchIntersecting;
    if (visible && hasNextPage && !anyFetching) {
      // Temporary trace: remove once infinite-scroll is stable
      console.warn("[inf-scroll] trigger fetchNextPage", {
        hasNextPage,
        anyFetching,
        isIntersecting,
        isPrefetchIntersecting,
      });
      fetchRef.current();
    }
  }, [isIntersecting, isPrefetchIntersecting, hasNextPage, anyFetching]);

  return {
    sentinelRef,
    prefetchSentinelRef,
    scrollRoot,
    setScrollRoot,
  };
}
