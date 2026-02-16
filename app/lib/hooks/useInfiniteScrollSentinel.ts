/**
 * Encapsulates infinite scroll sentinel logic: scroll root, two intersection
 * observers (prefetch + fetch), and effects that call fetchNextPage.
 * Use on pages with infinite query lists (Drafts, Posted, Scheduled, Templates).
 */

import { useEffect, useState } from "react";

import { useIntersectionObserver } from "./useIntersectionObserver";

interface UseInfiniteScrollSentinelOptions {
  isMobile: boolean;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function useInfiniteScrollSentinel({
  isMobile,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: UseInfiniteScrollSentinelOptions) {
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  // On desktop use the document's scrolling element so the observer tracks the
  // actual scroll container; on mobile use the listing's scroll container when set.
  const root = isMobile
    ? (scrollRoot ?? undefined)
    : typeof document !== "undefined"
      ? (document.scrollingElement ?? undefined)
      : undefined;

  const { ref: sentinelRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.8,
    root,
  });

  const { ref: prefetchSentinelRef, isIntersecting: isPrefetchIntersecting } =
    useIntersectionObserver({
      threshold: 0.7,
      root,
    });

  // Prefetch next page when user is 70% down (earlier than actual fetch at 80%)
  useEffect(() => {
    if (
      isPrefetchIntersecting &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isIntersecting
    ) {
      fetchNextPage();
    }
  }, [
    isPrefetchIntersecting,
    hasNextPage,
    isFetchingNextPage,
    isIntersecting,
    fetchNextPage,
  ]);

  // Fetch next page when sentinel becomes visible (backup in case prefetch didn't trigger)
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    sentinelRef,
    prefetchSentinelRef,
    scrollRoot,
    setScrollRoot,
  };
}
