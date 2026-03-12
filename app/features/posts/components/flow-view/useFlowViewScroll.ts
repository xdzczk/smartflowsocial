/**
 * Scroll container ref, viewport state (throttled), allow-fetch logic, and imperative scroll methods for FlowView.
 */

import type { Virtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  PREFERS_REDUCED_MOTION_QUERY,
  RIGHT_EDGE_FETCH_THRESHOLD_PX,
  RIGHT_EDGE_VIEWPORT_MULTIPLIER,
  SCROLL_EDGE_OFFSET_PX,
  SCROLL_VIEWPORT_THROTTLE_MS,
} from "../flow-view-constants";

export interface FlowSlot {
  type: string;
  item?: unknown;
  size: number;
}

export interface UseFlowViewScrollParams {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollElement: HTMLDivElement | null;
  slots: FlowSlot[];
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  isMobile: boolean;
  hasLiveEdge: boolean;
  scrollToLiveIndex: number;
  scrollToFirstFutureIndex: number;
  initialScrollIndex: number;
  cardSlotSize: number;
  flowItemsLength: number;
  hasMoreFuture: boolean;
  isLoadingMoreFuture: boolean;
  onFetchMoreFuture: () => void;
}

export interface FlowViewHandle {
  scrollToNext: () => void;
  scrollToInitial: () => void;
  scrollToNextWhenReady: () => void;
}

export function useFlowViewScroll(
  params: UseFlowViewScrollParams,
  ref: React.Ref<FlowViewHandle>
): {
  scrollViewport: { scrollLeft: number; clientWidth: number };
  allowFetch: boolean;
  initialScrollDoneRef: React.MutableRefObject<boolean>;
  allowFetchRef: React.MutableRefObject<boolean>;
  hasScrolledAwayFromLeftRef: React.MutableRefObject<boolean>;
  scrollToNextWhenReadyRef: React.MutableRefObject<boolean>;
} {
  const {
    scrollContainerRef,
    scrollElement,
    slots,
    rowVirtualizer,
    isMobile,
    hasLiveEdge,
    scrollToLiveIndex,
    scrollToFirstFutureIndex,
    initialScrollIndex,
    cardSlotSize,
    flowItemsLength,
    hasMoreFuture,
    isLoadingMoreFuture,
    onFetchMoreFuture,
  } = params;

  const initialScrollDoneRef = useRef(false);
  const allowFetchRef = useRef(false);
  const [allowFetch, setAllowFetch] = useState(false);
  const hasScrolledAwayFromLeftRef = useRef(false);
  const scrollToNextWhenReadyRef = useRef(false);
  const [scrollViewport, setScrollViewport] = useState({
    scrollLeft: 0,
    clientWidth: 2000,
  });
  const scrollViewportRafRef = useRef<number | null>(null);
  const scrollViewportLastMsRef = useRef(0);
  const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    const el = scrollElement;
    if (!el) return;
    const updateViewport = () => {
      setScrollViewport({
        scrollLeft: el.scrollLeft,
        clientWidth: el.clientWidth,
      });
    };
    const onScroll = () => {
      const now = Date.now();
      const elapsed = now - scrollViewportLastMsRef.current;
      if (scrollViewportRafRef.current != null)
        cancelAnimationFrame(scrollViewportRafRef.current);
      scrollViewportRafRef.current = requestAnimationFrame(() => {
        scrollViewportRafRef.current = null;
        if (elapsed >= SCROLL_VIEWPORT_THROTTLE_MS) {
          scrollViewportLastMsRef.current = now;
          updateViewport();
        }
      });
      if (scrollEndTimeoutRef.current)
        clearTimeout(scrollEndTimeoutRef.current);
      scrollEndTimeoutRef.current = setTimeout(() => {
        scrollEndTimeoutRef.current = null;
        scrollViewportLastMsRef.current = 0;
        updateViewport();
      }, 150);
    };
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    updateViewport();
    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("scroll", onScroll);
      if (scrollViewportRafRef.current != null)
        cancelAnimationFrame(scrollViewportRafRef.current);
      if (scrollEndTimeoutRef.current)
        clearTimeout(scrollEndTimeoutRef.current);
    };
  }, [scrollElement]);

  useLayoutEffect(() => {
    if (initialScrollDoneRef.current || flowItemsLength === 0 || !hasLiveEdge) {
      return;
    }
    initialScrollDoneRef.current = true;
    const scrollDelay = 200;
    const allowFetchDelay = 600;
    let offsetId: ReturnType<typeof setTimeout> | null = null;
    const scrollId = setTimeout(() => {
      rowVirtualizer.scrollToIndex(initialScrollIndex, {
        align: "start",
        behavior: "auto",
      });
      offsetId = setTimeout(() => {
        const el = scrollContainerRef.current;
        if (el) {
          el.scrollLeft = Math.max(0, el.scrollLeft - SCROLL_EDGE_OFFSET_PX);
        }
      }, 50);
    }, scrollDelay);
    const allowId = setTimeout(() => {
      allowFetchRef.current = true;
      setAllowFetch(true);
    }, allowFetchDelay);
    const checkScrollId = setTimeout(() => {
      const el = scrollContainerRef.current;
      if (el && el.scrollLeft > 10) {
        hasScrolledAwayFromLeftRef.current = true;
      }
    }, scrollDelay + 350);
    const fallbackId = setTimeout(() => {
      hasScrolledAwayFromLeftRef.current = true;
    }, 1500);
    return () => {
      clearTimeout(scrollId);
      if (offsetId !== null) clearTimeout(offsetId);
      clearTimeout(allowId);
      clearTimeout(checkScrollId);
      clearTimeout(fallbackId);
    };
  }, [
    flowItemsLength,
    hasLiveEdge,
    initialScrollIndex,
    rowVirtualizer,
    scrollContainerRef,
  ]);

  useEffect(() => {
    if (!scrollElement) return;
    const checkNearRight = () => {
      if (!allowFetch || !hasMoreFuture || isLoadingMoreFuture) return;
      const el = scrollContainerRef.current;
      if (!el) return;
      const distanceFromRight =
        el.scrollWidth - (el.scrollLeft + el.clientWidth);
      const threshold = Math.max(
        RIGHT_EDGE_FETCH_THRESHOLD_PX,
        el.clientWidth * RIGHT_EDGE_VIEWPORT_MULTIPLIER
      );
      if (distanceFromRight <= threshold) {
        onFetchMoreFuture();
      }
    };
    const onScroll = () => {
      const el = scrollContainerRef.current;
      if (el && el.scrollLeft > 10) {
        hasScrolledAwayFromLeftRef.current = true;
      }
      checkNearRight();
    };
    checkNearRight();
    scrollElement.addEventListener("scroll", onScroll, { passive: true });
    const pollId = setInterval(checkNearRight, 300);
    return () => {
      scrollElement.removeEventListener("scroll", onScroll);
      clearInterval(pollId);
    };
  }, [
    scrollContainerRef,
    scrollElement,
    allowFetch,
    hasMoreFuture,
    isLoadingMoreFuture,
    onFetchMoreFuture,
  ]);

  useEffect(() => {
    if (flowItemsLength === 0) return;
    if (hasLiveEdge) return;
    const allowId = setTimeout(() => {
      allowFetchRef.current = true;
      setAllowFetch(true);
      hasScrolledAwayFromLeftRef.current = true;
    }, 500);
    return () => clearTimeout(allowId);
  }, [flowItemsLength, hasLiveEdge]);

  const scrollToNext = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia(PREFERS_REDUCED_MOTION_QUERY).matches;
    const index = hasLiveEdge
      ? isMobile
        ? scrollToFirstFutureIndex
        : scrollToLiveIndex
      : slots.length - 1;
    let offsetPx = 0;
    for (let i = 0; i < index; i++) {
      offsetPx += slots[i]?.size ?? cardSlotSize;
    }
    const targetScrollLeft = Math.max(0, offsetPx - SCROLL_EDGE_OFFSET_PX);
    el.scrollTo({
      left: targetScrollLeft,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [
    scrollContainerRef,
    hasLiveEdge,
    isMobile,
    scrollToFirstFutureIndex,
    scrollToLiveIndex,
    slots,
    cardSlotSize,
  ]);

  const scrollToInitial = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollLeft = 0;
    }
    rowVirtualizer.scrollToIndex(0, { align: "start", behavior: "auto" });
  }, [scrollContainerRef, rowVirtualizer]);

  const scrollToNextWhenReady = useCallback(() => {
    scrollToNextWhenReadyRef.current = true;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToNext,
      scrollToInitial,
      scrollToNextWhenReady,
    }),
    [scrollToNext, scrollToInitial, scrollToNextWhenReady]
  );

  useEffect(() => {
    if (!scrollToNextWhenReadyRef.current) return;
    scrollToNextWhenReadyRef.current = false;
    const rafId = requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia(PREFERS_REDUCED_MOTION_QUERY).matches;
      const index = hasLiveEdge
        ? isMobile
          ? scrollToFirstFutureIndex
          : scrollToLiveIndex
        : slots.length - 1;
      let offsetPx = 0;
      for (let i = 0; i < index; i++) {
        offsetPx += slots[i]?.size ?? cardSlotSize;
      }
      const targetScrollLeft = Math.max(0, offsetPx - SCROLL_EDGE_OFFSET_PX);
      el.scrollTo({
        left: targetScrollLeft,
        behavior: reduceMotion ? "auto" : "auto",
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    scrollContainerRef,
    flowItemsLength,
    hasLiveEdge,
    isMobile,
    scrollToFirstFutureIndex,
    scrollToLiveIndex,
    slots,
    cardSlotSize,
  ]);

  return {
    scrollViewport,
    allowFetch,
    initialScrollDoneRef,
    allowFetchRef,
    hasScrolledAwayFromLeftRef,
    scrollToNextWhenReadyRef,
  };
}
