import { Link } from "@remix-run/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

/** Mobile breakpoint (px); below this we scroll to next scheduled on load */
const MOBILE_BREAKPOINT_PX = 768;

import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";

import type { CombinedContent } from "../types";

import { FlowCard } from "./FlowCard";

const CARD_WIDTH = 352;
const GAP = 28;
const CARD_SLOT_SIZE = CARD_WIDTH + GAP;
const CARD_MIN_HEIGHT = 232;

/** Mobile: smaller cards so ~1.3–1.5 cards visible; reduces “trapped” feel */
const CARD_WIDTH_MOBILE = 280;
const GAP_MOBILE = 20;
const CARD_SLOT_SIZE_MOBILE = CARD_WIDTH_MOBILE + GAP_MOBILE;
const CARD_MIN_HEIGHT_MOBILE = 200; /* ~14% shorter than desktop */

const SENTINEL_WIDTH = 120 + GAP;

/** Rubber-band overscroll: max pull (px) and resistance factor */
const OVERSCROLL_MAX_PX = 56;
const OVERSCROLL_RESISTANCE = 0.35;
const OVERSCROLL_SPRING_MS = 350;
const OVERSCROLL_SPRING_CURVE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
/** Edge threshold (px); wider so Chrome/sub-pixel scroll still triggers overscroll */
const OVERSCROLL_EDGE_PX = 8;

const LOADING_LABEL = "Loading…";

const SLOT_PAST_SENTINEL = "past-sentinel";
const SLOT_FUTURE_SENTINEL = "future-sentinel";

const NOW_MS = () => Date.now();

export function getGoLiveAt(item: CombinedContent): number {
  const posted = item.postedAt ? new Date(item.postedAt).getTime() : 0;
  const scheduled = item.scheduledAtUtc
    ? new Date(item.scheduledAtUtc).getTime()
    : 0;
  return posted || scheduled || 0;
}

type SlotType =
  | typeof SLOT_PAST_SENTINEL
  | "card"
  | typeof SLOT_FUTURE_SENTINEL;

interface FlowSlot {
  type: SlotType;
  item?: CombinedContent;
  size: number;
}

export interface FlowViewProps {
  flowItems: CombinedContent[];
  hasMorePast: boolean;
  hasMoreFuture: boolean;
  isLoadingMorePast?: boolean;
  isLoadingMoreFuture?: boolean;
  onCardClick: (item: CombinedContent) => void;
  onFetchMorePast: () => void;
  onFetchMoreFuture: () => void;
  /** Called when hasLiveEdge (future items exist) changes; used to show Scroll to next in header */
  onHasLiveEdgeChange?: (hasLiveEdge: boolean) => void;
}

export interface FlowViewHandle {
  /** On mobile scrolls to next scheduled (first future); on desktop to live edge (last past + first future) */
  scrollToNext: () => void;
}

const FlowViewInner = forwardRef<FlowViewHandle, FlowViewProps>(
  function FlowViewInner(
    {
      flowItems,
      hasMorePast,
      hasMoreFuture,
      isLoadingMorePast = false,
      isLoadingMoreFuture = false,
      onCardClick,
      onFetchMorePast,
      onFetchMoreFuture,
      onHasLiveEdgeChange,
    },
    ref
  ): React.ReactNode {
    const [nowMs, setNowMs] = useState(() => NOW_MS());
    useEffect(() => {
      const interval = setInterval(() => {
        setNowMs(NOW_MS());
      }, 60_000);
      return () => clearInterval(interval);
    }, []);
    const [isMobile, setIsMobile] = useState(() =>
      typeof window !== "undefined"
        ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches
        : false
    );
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const initialScrollDoneRef = useRef(false);
    /** Rubber-band overscroll offset (px); negative = pulled from left, positive = from right */
    const [overscrollPx, setOverscrollPx] = useState(0);
    const [isOverscrollSpringing, setIsOverscrollSpringing] = useState(false);
    const overscrollPxRef = useRef(0);
    const springBackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const rubberBandWrapperRef = useRef<HTMLDivElement | null>(null);
    const touchStartXRef = useRef(0);
    /** Block load-more until initial scroll has had time; prevents request loop when scrollToIndex fails */
    const allowFetchRef = useRef(false);
    /** State so fetch effect re-runs when we allow fetch (ref alone doesn't trigger re-render) */
    const [allowFetch, setAllowFetch] = useState(false);
    /** Only fetch past when we've scrolled away from left (initial scroll succeeded); prevents loop when stuck at scroll 0 */
    const hasScrolledAwayFromLeftRef = useRef(false);
    const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
      null
    );

    useEffect(() => {
      overscrollPxRef.current = overscrollPx;
    }, [overscrollPx]);

    const scheduleOverscrollSpringBack = useCallback(() => {
      if (springBackTimeoutRef.current)
        clearTimeout(springBackTimeoutRef.current);
      springBackTimeoutRef.current = setTimeout(() => {
        springBackTimeoutRef.current = null;
        if (overscrollPxRef.current !== 0) {
          setIsOverscrollSpringing(true);
          requestAnimationFrame(() => {
            setOverscrollPx(0);
          });
        }
      }, 120);
    }, []);

    useEffect(() => {
      const el = scrollContainerRef.current;
      if (!el) return;

      const handleWheel = (e: WheelEvent) => {
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
        const atLeft = scrollLeft <= OVERSCROLL_EDGE_PX;
        const atRight =
          maxScrollLeft <= OVERSCROLL_EDGE_PX ||
          scrollLeft >= maxScrollLeft - OVERSCROLL_EDGE_PX;
        const deltaX = e.deltaX;
        const current = overscrollPxRef.current;

        if (atLeft && deltaX < 0) {
          e.preventDefault();
          const next = Math.min(
            OVERSCROLL_MAX_PX,
            current - deltaX * OVERSCROLL_RESISTANCE
          );
          setOverscrollPx(next);
          scheduleOverscrollSpringBack();
        } else if (atRight && deltaX > 0) {
          e.preventDefault();
          const next = Math.max(
            -OVERSCROLL_MAX_PX,
            current - deltaX * OVERSCROLL_RESISTANCE
          );
          setOverscrollPx(next);
          scheduleOverscrollSpringBack();
        }
      };

      const handleTouchStart = (e: TouchEvent) => {
        touchStartXRef.current = e.touches[0]?.clientX ?? 0;
        if (springBackTimeoutRef.current) {
          clearTimeout(springBackTimeoutRef.current);
          springBackTimeoutRef.current = null;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
        const atLeft = scrollLeft <= OVERSCROLL_EDGE_PX;
        const atRight =
          maxScrollLeft <= OVERSCROLL_EDGE_PX ||
          scrollLeft >= maxScrollLeft - OVERSCROLL_EDGE_PX;
        const touch = e.touches[0];
        if (!touch) return;
        const prevX = touchStartXRef.current;
        touchStartXRef.current = touch.clientX;
        const moveX = touch.clientX - prevX;
        const current = overscrollPxRef.current;

        if (atLeft && moveX > 0) {
          const next = Math.min(
            OVERSCROLL_MAX_PX,
            current + moveX * OVERSCROLL_RESISTANCE
          );
          setOverscrollPx(next);
        } else if (atRight && moveX < 0) {
          const next = Math.max(
            -OVERSCROLL_MAX_PX,
            current + moveX * OVERSCROLL_RESISTANCE
          );
          setOverscrollPx(next);
        }
      };

      const handleTouchEnd = () => {
        if (overscrollPxRef.current !== 0) {
          setIsOverscrollSpringing(true);
          requestAnimationFrame(() => {
            setOverscrollPx(0);
          });
        }
      };

      el.addEventListener("wheel", handleWheel, { passive: false });
      el.addEventListener("touchstart", handleTouchStart, { passive: true });
      el.addEventListener("touchmove", handleTouchMove, { passive: true });
      el.addEventListener("touchend", handleTouchEnd, { passive: true });

      return () => {
        el.removeEventListener("wheel", handleWheel);
        el.removeEventListener("touchstart", handleTouchStart);
        el.removeEventListener("touchmove", handleTouchMove);
        el.removeEventListener("touchend", handleTouchEnd);
        if (springBackTimeoutRef.current)
          clearTimeout(springBackTimeoutRef.current);
      };
    }, [scheduleOverscrollSpringBack]);

    const handleOverscrollTransitionEnd = useCallback(
      (e: React.TransitionEvent) => {
        if (e.propertyName === "transform") setIsOverscrollSpringing(false);
      },
      []
    );

    useEffect(() => {
      const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
      const fn = () => setIsMobile(mq.matches);
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    }, []);
    const setScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
      scrollContainerRef.current = node;
      setScrollElement(node);
    }, []);

    const firstFutureIndex = flowItems.findIndex(
      (item) => getGoLiveAt(item) > nowMs
    );
    const pastCount =
      firstFutureIndex < 0 ? flowItems.length : firstFutureIndex;

    const cardSlotSize = isMobile ? CARD_SLOT_SIZE_MOBILE : CARD_SLOT_SIZE;
    const slots = useMemo((): FlowSlot[] => {
      const result: FlowSlot[] = [];
      if (hasMorePast) {
        result.push({ type: SLOT_PAST_SENTINEL, size: SENTINEL_WIDTH });
      }
      const pastItems =
        firstFutureIndex < 0 ? flowItems : flowItems.slice(0, firstFutureIndex);
      for (const item of pastItems) {
        result.push({ type: "card", item, size: cardSlotSize });
      }
      const futureItems =
        firstFutureIndex >= 0 ? flowItems.slice(firstFutureIndex) : [];
      for (const item of futureItems) {
        result.push({ type: "card", item, size: cardSlotSize });
      }
      if (hasMoreFuture) {
        result.push({ type: SLOT_FUTURE_SENTINEL, size: SENTINEL_WIDTH });
      }
      return result;
    }, [flowItems, firstFutureIndex, hasMorePast, hasMoreFuture, cardSlotSize]);

    /* eslint-disable react-hooks/incompatible-library -- TanStack Virtual returns functions; we accept non-memoized updates */
    const rowVirtualizer = useVirtualizer({
      count: slots.length,
      getScrollElement: () => scrollContainerRef.current,
      estimateSize: (index) => slots[index]?.size ?? cardSlotSize,
      horizontal: true,
      overscan: 2,
      getItemKey: (index) => {
        const slot = slots[index];
        if (!slot) return String(index);
        if (slot.type === "card" && slot.item) return slot.item.id;
        return `${String(slot.type)}-${index}`;
      },
    });
    /* eslint-enable react-hooks/incompatible-library */

    const pastSentinelIndex = hasMorePast ? 0 : -1;
    const futureSentinelIndex = hasMoreFuture ? slots.length - 1 : -1;

    const { ref: pastSentinelRef, isIntersecting: isPastSentinelVisible } =
      useIntersectionObserver({
        threshold: 0.3,
        root: scrollElement,
      });
    const { ref: futureSentinelRef, isIntersecting: isFutureSentinelVisible } =
      useIntersectionObserver({
        threshold: 0.3,
        root: scrollElement,
      });

    // Past-fetch when past sentinel is visible. Duplicate requests are prevented by pastSentinelInFlightRef in useFlowQuery.
    useEffect(() => {
      if (
        !allowFetch ||
        !isPastSentinelVisible ||
        !hasMorePast ||
        isLoadingMorePast
      ) {
        return;
      }
      onFetchMorePast();
    }, [
      allowFetch,
      isPastSentinelVisible,
      hasMorePast,
      isLoadingMorePast,
      onFetchMorePast,
    ]);

    useEffect(() => {
      if (
        !allowFetch ||
        !isFutureSentinelVisible ||
        !hasMoreFuture ||
        isLoadingMoreFuture
      ) {
        return;
      }
      onFetchMoreFuture();
    }, [
      allowFetch,
      isFutureSentinelVisible,
      hasMoreFuture,
      isLoadingMoreFuture,
      onFetchMoreFuture,
    ]);

    const hasLiveEdge = firstFutureIndex >= 0;
    const scrollToLiveIndex =
      firstFutureIndex <= 0 ? 0 : (hasMorePast ? 1 : 0) + firstFutureIndex - 1;
    // On mobile, show next scheduled first (first future card at start)
    const scrollToFirstFutureIndex =
      firstFutureIndex < 0 ? 0 : (hasMorePast ? 1 : 0) + firstFutureIndex;
    const initialScrollIndex = isMobile
      ? scrollToFirstFutureIndex
      : scrollToLiveIndex;

    // On first load, scroll: desktop = live edge (last past + first future); mobile = next scheduled first.
    // Defer scroll so virtualizer/scroll container can measure; only allow past-fetch when we've scrolled away from left to avoid request loop when scroll fails.
    useEffect(() => {
      if (
        initialScrollDoneRef.current ||
        flowItems.length === 0 ||
        !hasLiveEdge
      ) {
        return;
      }
      initialScrollDoneRef.current = true;
      const scrollDelay = 200;
      const allowFetchDelay = 600;
      const scrollId = setTimeout(() => {
        rowVirtualizer.scrollToIndex(initialScrollIndex, {
          align: "start",
          behavior: "auto",
        });
      }, scrollDelay);
      const allowId = setTimeout(() => {
        allowFetchRef.current = true;
        setAllowFetch(true);
      }, allowFetchDelay);
      // Allow past-fetch when scroll has moved away from 0 (initial scroll succeeded)
      const checkScrollId = setTimeout(() => {
        const el = scrollContainerRef.current;
        if (el && el.scrollLeft > 10) {
          hasScrolledAwayFromLeftRef.current = true;
        }
      }, scrollDelay + 350);
      // Fallback: if initial scroll didn't move (e.g. virtualizer slow), allow past-fetch after 1.5s so scrolling left can load older posts
      const fallbackId = setTimeout(() => {
        hasScrolledAwayFromLeftRef.current = true;
      }, 1500);
      return () => {
        clearTimeout(scrollId);
        clearTimeout(allowId);
        clearTimeout(checkScrollId);
        clearTimeout(fallbackId);
      };
    }, [flowItems.length, hasLiveEdge, initialScrollIndex, rowVirtualizer]);

    // Mark that we've scrolled away from left when user scrolls (so past-fetch is allowed when they scroll back left)
    useEffect(() => {
      const el = scrollElement;
      if (!el) return;
      const onScroll = () => {
        if (el.scrollLeft > 10) {
          hasScrolledAwayFromLeftRef.current = true;
        }
      };
      el.addEventListener("scroll", onScroll, { passive: true });
      return () => el.removeEventListener("scroll", onScroll);
    }, [scrollElement]);

    // When there's no live edge (only past or only future), allow load-more after a short delay so fetch isn't blocked
    useEffect(() => {
      if (flowItems.length === 0) return;
      if (hasLiveEdge) return;
      const allowId = setTimeout(() => {
        allowFetchRef.current = true;
        setAllowFetch(true);
        hasScrolledAwayFromLeftRef.current = true;
      }, 500);
      return () => clearTimeout(allowId);
    }, [flowItems.length, hasLiveEdge]);

    const handleScrollToNext = useCallback(() => {
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const index = isMobile ? scrollToFirstFutureIndex : scrollToLiveIndex;
      rowVirtualizer.scrollToIndex(index, {
        align: "start",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }, [isMobile, scrollToFirstFutureIndex, scrollToLiveIndex, rowVirtualizer]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToNext: handleScrollToNext,
      }),
      [handleScrollToNext]
    );

    useEffect(() => {
      onHasLiveEdgeChange?.(hasLiveEdge);
    }, [hasLiveEdge, onHasLiveEdgeChange]);

    if (flowItems.length === 0) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center"
          role="region"
          aria-label="Post timeline"
        >
          <p className="text-muted-foreground text-sm">
            No posts yet. Create your first post or schedule one to see your
            flow.
          </p>
          <Link
            to="/dashboard/newpost"
            className="border-border text-foreground hover:bg-muted/50 focus:ring-primary rounded-md border px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none"
          >
            Create post
          </Link>
        </div>
      );
    }

    const virtualItems = rowVirtualizer.getVirtualItems();

    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full">
        <div
          ref={setScrollContainerRef}
          role="region"
          aria-label="Post timeline: past and scheduled"
          className="scrollbar-hide h-full min-h-[200px] min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain pt-2 pb-2 md:min-h-[232px]"
        >
          <div
            ref={rubberBandWrapperRef}
            role="presentation"
            style={{
              transform: `translateX(${overscrollPx}px)`,
              transition: isOverscrollSpringing
                ? `transform ${OVERSCROLL_SPRING_MS}ms ${OVERSCROLL_SPRING_CURVE}`
                : "none",
              height: "100%",
              minHeight: isMobile ? CARD_MIN_HEIGHT_MOBILE : CARD_MIN_HEIGHT,
              width: rowVirtualizer.getTotalSize(),
              position: "relative",
              minWidth: "100%",
              paddingTop: 6,
            }}
            onTransitionEnd={handleOverscrollTransitionEnd}
          >
            {virtualItems.map((virtualColumn) => {
              const slot = slots[virtualColumn.index];
              if (!slot) return null;

              const isPastSentinelSlot =
                slot.type === SLOT_PAST_SENTINEL &&
                virtualColumn.index === pastSentinelIndex;
              const isFutureSentinelSlot =
                slot.type === SLOT_FUTURE_SENTINEL &&
                virtualColumn.index === futureSentinelIndex;

              return (
                <div
                  key={virtualColumn.key}
                  data-index={virtualColumn.index}
                  ref={
                    isPastSentinelSlot
                      ? pastSentinelRef
                      : isFutureSentinelSlot
                        ? futureSentinelRef
                        : undefined
                  }
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transform: `translateX(${virtualColumn.start}px)`,
                    width: `${virtualColumn.size}px`,
                    height: "100%",
                    display: "flex",
                    alignItems: "stretch",
                  }}
                >
                  {slot.type === SLOT_PAST_SENTINEL ? (
                    <div className="flex min-w-0 flex-1 items-center justify-center">
                      {isLoadingMorePast ? (
                        <span className="text-muted-foreground text-sm">
                          {LOADING_LABEL}
                        </span>
                      ) : (
                        <span
                          className="text-muted-foreground text-sm"
                          aria-hidden
                        >
                          •
                        </span>
                      )}
                    </div>
                  ) : slot.type === SLOT_FUTURE_SENTINEL ? (
                    <div className="flex min-w-0 flex-1 items-center justify-center">
                      {isLoadingMoreFuture ? (
                        <span className="text-muted-foreground text-sm">
                          {LOADING_LABEL}
                        </span>
                      ) : (
                        <span
                          className="text-muted-foreground text-sm"
                          aria-hidden
                        >
                          •
                        </span>
                      )}
                    </div>
                  ) : slot.item ? (
                    <div className="flex flex-shrink-0 items-stretch px-0.5">
                      <FlowCard
                        item={slot.item}
                        onClick={() => onCardClick(slot.item!)}
                        isLastPosted={
                          firstFutureIndex >= 1
                            ? virtualColumn.index ===
                              (hasMorePast ? 1 : 0) + firstFutureIndex - 1
                            : undefined
                        }
                        isNextScheduled={
                          virtualColumn.index ===
                          (hasMorePast ? 1 : 0) + firstFutureIndex
                        }
                        minutesUntil={(() => {
                          const goLive = getGoLiveAt(slot.item);
                          if (goLive <= nowMs) return;
                          return Math.round((goLive - nowMs) / 60000);
                        })()}
                        nowMs={nowMs}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer strip: flex-shrink-0 so it never steals space from the scroll area */}
        {(pastCount === 0 && flowItems.length > 0 && !hasMorePast) ||
        (firstFutureIndex < 0 && flowItems.length > 0) ? (
          <div
            className="border-border/60 text-muted-foreground flex flex-shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-2 text-xs"
            role="status"
            aria-live="polite"
          >
            {pastCount === 0 && flowItems.length > 0 && !hasMorePast ? (
              <span>No recent posts.</span>
            ) : null}
            {firstFutureIndex < 0 && flowItems.length > 0 ? (
              <span>
                Nothing scheduled yet.{" "}
                <Link
                  to="/dashboard/newpost"
                  className="text-foreground/80 hover:text-foreground underline"
                >
                  Schedule a post
                </Link>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
);

FlowViewInner.displayName = "FlowView";

export const FlowView = FlowViewInner;
