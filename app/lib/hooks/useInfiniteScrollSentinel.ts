/**
 * Encapsulates infinite scroll sentinel logic: scroll root, two intersection
 * observers (prefetch + fetch), and effects that call fetchNextPage.
 * Use on pages with infinite query lists (Drafts, Posted, Scheduled, Templates).
 */

import { useEffect, useRef, useState } from "react";

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
  const prefetchTriggeredRef = useRef(false);
  const fetchTriggeredRef = useRef(false);

  // On desktop use the viewport (null) so the sentinel is observed when it nears
  // the viewport; on mobile use the listing's scroll container when set.
  // Using null on desktop avoids relying on document.scrollingElement when the
  // layout scroll container is not the document (e.g. dashboard content wrapper).
  const root = isMobile ? (scrollRoot ?? undefined) : undefined;

  // Trigger when sentinel is within 400px of viewport bottom so "load more" fires
  // before the user reaches the end (better UX and works with various scroll roots).
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

  // Prefetch next page when user is 70% down (earlier than actual fetch at 80%)
  useEffect(() => {
    if (
      isPrefetchIntersecting &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isIntersecting
    ) {
      if (!prefetchTriggeredRef.current) {
        prefetchTriggeredRef.current = true;
        fetchNextPage();
      }
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
      if (!fetchTriggeredRef.current) {
        fetchTriggeredRef.current = true;
        fetchNextPage();
      }
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Reset triggers once sentinels leave view so we can load again on further scroll.
  useEffect(() => {
    if (!isPrefetchIntersecting) prefetchTriggeredRef.current = false;
  }, [isPrefetchIntersecting]);

  useEffect(() => {
    if (!isIntersecting) fetchTriggeredRef.current = false;
  }, [isIntersecting]);

  return {
    sentinelRef,
    prefetchSentinelRef,
    scrollRoot,
    setScrollRoot,
  };
}
