/**
 * Encapsulates infinite scroll sentinel logic: scroll root, two intersection
 * observers (prefetch + fetch), and a single effect that calls fetchNextPage.
 * Use on pages with infinite query lists (Drafts, Posted, Scheduled, Templates).
 */

import { useEffect, useRef, useState } from "react";

import { useIntersectionObserver } from "./useIntersectionObserver";

interface UseInfiniteScrollSentinelOptions {
  isMobile: boolean;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  loadedPageCount?: number;
  fetchNextPage: () => void;
}

export function useInfiniteScrollSentinel({
  isMobile,
  hasNextPage,
  isFetchingNextPage,
  loadedPageCount,
  fetchNextPage,
}: UseInfiniteScrollSentinelOptions) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  // Single flag: set when fetchNextPage is dispatched, cleared only when
  // loadedPageCount actually changes (new page appended or query reset).
  const fetchInFlightRef = useRef(false);
  const lastLoadedPageCountRef = useRef<number | undefined>(loadedPageCount);

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

  // Re-arm after a page is successfully appended (or reset on filter change).
  useEffect(() => {
    if (isFetchingNextPage) return;

    const previous = lastLoadedPageCountRef.current ?? 0;
    const current =
      typeof loadedPageCount === "number" ? loadedPageCount : previous;

    if (current !== previous) {
      lastLoadedPageCountRef.current = current;
      fetchInFlightRef.current = false;
    }
  }, [isFetchingNextPage, loadedPageCount]);

  // Reset when both sentinels leave the viewport (user scrolled back up).
  useEffect(() => {
    if (!isIntersecting && !isPrefetchIntersecting) {
      fetchInFlightRef.current = false;
    }
  }, [isIntersecting, isPrefetchIntersecting]);

  // Consolidated trigger: fires at most once per page transition.
  useEffect(() => {
    if (fetchInFlightRef.current) return;

    const visible = isIntersecting || isPrefetchIntersecting;
    if (visible && hasNextPage && !isFetchingNextPage) {
      fetchInFlightRef.current = true;
      fetchNextPage();
    }
  }, [
    isIntersecting,
    isPrefetchIntersecting,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  return {
    sentinelRef,
    prefetchSentinelRef,
    scrollRoot,
    setScrollRoot,
  };
}
