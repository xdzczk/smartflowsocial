/**
 * Encapsulates infinite scroll sentinel logic: scroll root, two intersection
 * observers (prefetch + fetch), and a single effect that calls fetchNextPage.
 * Use on pages with infinite query lists (Drafts, Posted, Scheduled, Templates).
 *
 * Page-count gate: fetchNextPage is only called when the loaded page count has
 * increased since the last fetch.  If a fetch fails to grow the page array (e.g.
 * the response can't be appended), a cooldown prevents hammering the server.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useIntersectionObserver } from "./useIntersectionObserver";

interface UseInfiniteScrollSentinelOptions {
  isMobile: boolean;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  isFetching?: boolean;
  loadedPageCount?: number;
  fetchNextPage: () => void;
}

const RETRY_COOLDOWN_MS = 3_000;

export function useInfiniteScrollSentinel({
  isMobile,
  hasNextPage,
  isFetchingNextPage,
  isFetching,
  loadedPageCount,
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

  const fetchRef = useRef(fetchNextPage);
  useEffect(() => {
    fetchRef.current = fetchNextPage;
  }, [fetchNextPage]);

  // Track the page count at which we last triggered a fetch.
  // Only allow a new fetch when the page count grows past that mark.
  const lastTriggeredAtRef = useRef(0);
  const cooldownUntilRef = useRef(0);

  const pageCount = loadedPageCount ?? 0;

  // Reset the gate whenever the page count increases (successful accumulation).
  useEffect(() => {
    if (pageCount > lastTriggeredAtRef.current) {
      lastTriggeredAtRef.current = pageCount;
      cooldownUntilRef.current = 0;
    }
  }, [pageCount]);

  const triggerFetch = useCallback(() => {
    // Only trigger if pages have grown since the last trigger.
    if (pageCount < lastTriggeredAtRef.current) return;

    const now = Date.now();
    if (now < cooldownUntilRef.current) return;

    lastTriggeredAtRef.current = pageCount + 1;
    cooldownUntilRef.current = now + RETRY_COOLDOWN_MS;

    console.warn("[inf-scroll] trigger fetchNextPage", {
      pageCount,
      hasNextPage,
    });
    fetchRef.current();
  }, [pageCount, hasNextPage]);

  useEffect(() => {
    const visible = isIntersecting || isPrefetchIntersecting;
    if (!visible || !hasNextPage || anyFetching) return;

    const now = Date.now();
    if (now < cooldownUntilRef.current) {
      // Schedule a retry after cooldown expires.
      const delay = cooldownUntilRef.current - now;
      const timer = setTimeout(() => triggerFetch(), delay);
      return () => clearTimeout(timer);
    }

    triggerFetch();
  }, [
    isIntersecting,
    isPrefetchIntersecting,
    hasNextPage,
    anyFetching,
    triggerFetch,
  ]);

  return {
    sentinelRef,
    prefetchSentinelRef,
    scrollRoot,
    setScrollRoot,
  };
}
