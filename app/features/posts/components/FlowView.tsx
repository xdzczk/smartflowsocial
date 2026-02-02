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
const SENTINEL_WIDTH = 120 + GAP;

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
    /** Block load-more until initial scroll has had time; prevents request loop when scrollToIndex fails */
    const allowFetchRef = useRef(false);
    /** Only fetch past when we've scrolled away from left (initial scroll succeeded); prevents loop when stuck at scroll 0 */
    const hasScrolledAwayFromLeftRef = useRef(false);
    const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
      null
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

    const slots = useMemo((): FlowSlot[] => {
      const result: FlowSlot[] = [];
      if (hasMorePast) {
        result.push({ type: SLOT_PAST_SENTINEL, size: SENTINEL_WIDTH });
      }
      const pastItems =
        firstFutureIndex < 0 ? flowItems : flowItems.slice(0, firstFutureIndex);
      for (const item of pastItems) {
        result.push({ type: "card", item, size: CARD_SLOT_SIZE });
      }
      const futureItems =
        firstFutureIndex >= 0 ? flowItems.slice(firstFutureIndex) : [];
      for (const item of futureItems) {
        result.push({ type: "card", item, size: CARD_SLOT_SIZE });
      }
      if (hasMoreFuture) {
        result.push({ type: SLOT_FUTURE_SENTINEL, size: SENTINEL_WIDTH });
      }
      return result;
    }, [flowItems, firstFutureIndex, hasMorePast, hasMoreFuture]);

    /* eslint-disable react-hooks/incompatible-library -- TanStack Virtual returns functions; we accept non-memoized updates */
    const rowVirtualizer = useVirtualizer({
      count: slots.length,
      getScrollElement: () => scrollContainerRef.current,
      estimateSize: (index) => slots[index]?.size ?? CARD_SLOT_SIZE,
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

    useEffect(() => {
      if (
        !allowFetchRef.current ||
        !hasScrolledAwayFromLeftRef.current ||
        !isPastSentinelVisible ||
        !hasMorePast ||
        isLoadingMorePast
      ) {
        return;
      }
      onFetchMorePast();
    }, [
      isPastSentinelVisible,
      hasMorePast,
      isLoadingMorePast,
      onFetchMorePast,
    ]);

    useEffect(() => {
      if (
        !allowFetchRef.current ||
        !isFutureSentinelVisible ||
        !hasMoreFuture ||
        isLoadingMoreFuture
      ) {
        return;
      }
      onFetchMoreFuture();
    }, [
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
      <div className="flex min-h-0 w-full flex-col">
        <div
          ref={setScrollContainerRef}
          role="region"
          aria-label="Post timeline: past and scheduled"
          className="scrollbar-hide min-h-[232px] w-full overflow-x-auto overflow-y-hidden pt-2 pb-2"
        >
          <div
            style={{
              height: "100%",
              minHeight: CARD_MIN_HEIGHT,
              width: rowVirtualizer.getTotalSize(),
              position: "relative",
              minWidth: "100%",
              paddingTop: 6,
            }}
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

        {pastCount === 0 && flowItems.length > 0 && !hasMorePast ? (
          <p className="text-muted-foreground px-4 text-xs">No recent posts.</p>
        ) : null}
        {firstFutureIndex < 0 && flowItems.length > 0 ? (
          <p className="text-muted-foreground px-4 text-xs">
            Nothing scheduled yet.{" "}
            <Link to="/dashboard/newpost" className="underline">
              Schedule a post
            </Link>
          </p>
        ) : null}
      </div>
    );
  }
);

FlowViewInner.displayName = "FlowView";

export const FlowView = FlowViewInner;
