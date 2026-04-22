import { Link } from "@remix-run/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { EmptyState } from "~/components/ui/empty-state";
import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";

import type { CombinedContent } from "../types";

import { useFlowViewOverscroll, useFlowViewScroll } from "./flow-view";
import {
  CARD_MIN_HEIGHT,
  CARD_MIN_HEIGHT_MOBILE,
  CARD_SLOT_SIZE,
  CARD_SLOT_SIZE_MOBILE,
  getGoLiveAt,
  LOADING_LABEL,
  MOBILE_BREAKPOINT_PX,
  OVERSCROLL_SPRING_CURVE,
  OVERSCROLL_SPRING_MS,
  PAST_FETCH_DEBOUNCE_MS,
  PREFERS_REDUCED_MOTION_QUERY,
  SCROLL_EDGE_OFFSET_PX,
  SENTINEL_PREFETCH_ROOT_MARGIN_PX,
  SENTINEL_WIDTH,
  SLOT_CTA,
  SLOT_FUTURE_SENTINEL,
  SLOT_PAST_SENTINEL,
} from "./flow-view-constants";
import { FlowCard } from "./FlowCard";

export { getGoLiveAt } from "./flow-view-constants";

const NOW_MS = () => Date.now();

type SlotType =
  | typeof SLOT_PAST_SENTINEL
  | "card"
  | typeof SLOT_FUTURE_SENTINEL
  | typeof SLOT_CTA;

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
  /** Number of items just prepended; used to compensate scroll so position doesn't jump */
  lastPrependedPastCount?: number;
  /** Called after scroll was compensated for prepended past items */
  onPrependedPastCompensated?: () => void;
  onCardClick: (item: CombinedContent) => void;
  onFetchMorePast: () => void;
  onFetchMoreFuture: () => void;
  /** Called when hasLiveEdge (future items exist) changes; used to show Scroll to next in header */
  onHasLiveEdgeChange?: (hasLiveEdge: boolean) => void;
  /** True when first-run is done but no scheduled/published items exist yet. */
  isPostActivationEmpty?: boolean;
}

export interface FlowViewHandle {
  /** On mobile scrolls to next scheduled (first future); on desktop to live edge (last past + first future) */
  scrollToNext: () => void;
  /** Reset horizontal scroll to initial position (e.g. when queue filter changes). */
  scrollToInitial: () => void;
  /** Request scroll to default position after next flowItems update (use when filter changes so we scroll with new data). */
  scrollToNextWhenReady: () => void;
}

const FlowViewInner = forwardRef<FlowViewHandle, FlowViewProps>(
  function FlowViewInner(
    {
      flowItems,
      hasMorePast,
      hasMoreFuture,
      isLoadingMorePast = false,
      isLoadingMoreFuture = false,
      lastPrependedPastCount = 0,
      onPrependedPastCompensated,
      onCardClick,
      onFetchMorePast,
      onFetchMoreFuture,
      onHasLiveEdgeChange,
      isPostActivationEmpty = false,
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
    const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
      null
    );
    const setScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
      scrollContainerRef.current = node;
      setScrollElement(node);
    }, []);
    /** Id of the item that was the first future (next scheduled) last render; used to detect when it gets published and trigger smooth scroll */
    const prevFirstFutureIdRef = useRef<string | null>(null);

    useEffect(() => {
      const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
      const fn = () => setIsMobile(mq.matches);
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    }, []);

    const firstFutureIndex = flowItems.findIndex(
      (item) => getGoLiveAt(item) > nowMs
    );

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
      result.push({ type: SLOT_CTA, size: cardSlotSize });
      return result;
    }, [flowItems, firstFutureIndex, hasMorePast, hasMoreFuture, cardSlotSize]);

    // TanStack Virtual returns unstable refs; React Compiler skips this component by design.
    // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer API
    const rowVirtualizer = useVirtualizer({
      count: slots.length,
      getScrollElement: () => scrollContainerRef.current,
      estimateSize: (index) => slots[index]?.size ?? cardSlotSize,
      horizontal: true,
      overscan: isMobile ? 4 : 2,
      getItemKey: (index) => {
        const slot = slots[index];
        if (!slot) return String(index);
        if (slot.type === "card" && slot.item) return slot.item.id;
        if (slot.type === SLOT_CTA) return "flow-cta-create-post";
        return `${String(slot.type)}-${index}`;
      },
    });

    const pastSentinelIndex = hasMorePast ? 0 : -1;
    const futureSentinelIndex = hasMoreFuture
      ? slots.length - 2
      : -1; /* CTA is last */

    const hasLiveEdge = firstFutureIndex >= 0;
    const scrollToLiveIndex =
      firstFutureIndex <= 0 ? 0 : (hasMorePast ? 1 : 0) + firstFutureIndex - 1;
    const scrollToFirstFutureIndex =
      firstFutureIndex < 0 ? 0 : (hasMorePast ? 1 : 0) + firstFutureIndex;
    const initialScrollIndex = isMobile
      ? scrollToFirstFutureIndex
      : scrollToLiveIndex;

    const scrollHookResult = useFlowViewScroll(
      {
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
        flowItemsLength: flowItems.length,
        hasMoreFuture,
        isLoadingMoreFuture,
        onFetchMoreFuture,
      },
      ref
    );
    const { scrollViewport, allowFetch } = scrollHookResult;

    const { overscrollPx, isOverscrollSpringing, onOverscrollTransitionEnd } =
      useFlowViewOverscroll(scrollElement);

    const { ref: pastSentinelRef, isIntersecting: isPastSentinelVisible } =
      useIntersectionObserver({
        threshold: 0.3,
        root: scrollElement,
        rootMargin: `0px 0px 0px ${SENTINEL_PREFETCH_ROOT_MARGIN_PX}px`,
      });
    const { ref: futureSentinelRef, isIntersecting: isFutureSentinelVisible } =
      useIntersectionObserver({
        threshold: 0.3,
        root: scrollElement,
        rootMargin: `0px ${SENTINEL_PREFETCH_ROOT_MARGIN_PX}px 0px 0px`,
      });

    // When older posts are prepended, shift scroll so the user's view doesn't jump.
    useLayoutEffect(() => {
      if (lastPrependedPastCount <= 0) return;
      const el = scrollContainerRef.current;
      if (!el) return;
      const delta = lastPrependedPastCount * cardSlotSize;
      el.scrollLeft += delta;
      onPrependedPastCompensated?.();
    }, [lastPrependedPastCount, cardSlotSize, onPrependedPastCompensated]);

    // Past-fetch when past sentinel is visible. Debounce so we don't fetch mid fast-scroll (reduces lag/flicker).
    const pastFetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    useEffect(() => {
      if (
        !allowFetch ||
        !isPastSentinelVisible ||
        !hasMorePast ||
        isLoadingMorePast
      ) {
        if (pastFetchDebounceRef.current) {
          clearTimeout(pastFetchDebounceRef.current);
          pastFetchDebounceRef.current = null;
        }
        return;
      }
      pastFetchDebounceRef.current = setTimeout(() => {
        pastFetchDebounceRef.current = null;
        onFetchMorePast();
      }, PAST_FETCH_DEBOUNCE_MS);
      return () => {
        if (pastFetchDebounceRef.current) {
          clearTimeout(pastFetchDebounceRef.current);
          pastFetchDebounceRef.current = null;
        }
      };
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

    useEffect(() => {
      onHasLiveEdgeChange?.(hasLiveEdge);
    }, [hasLiveEdge, onHasLiveEdgeChange]);

    // When the next scheduled post is published (live update), smooth scroll to default position:
    // desktop = last posted card visible, mobile = next scheduled card visible
    useEffect(() => {
      if (flowItems.length === 0) return;
      const lastPastItem =
        firstFutureIndex > 0 ? flowItems[firstFutureIndex - 1] : null;
      const currentFirstFutureId =
        firstFutureIndex >= 0
          ? (flowItems[firstFutureIndex]?.id ?? null)
          : null;
      const prevId = prevFirstFutureIdRef.current;
      const justPublished = Boolean(
        lastPastItem?.id && prevId != null && lastPastItem.id === prevId
      );
      prevFirstFutureIdRef.current = currentFirstFutureId;

      if (!justPublished) return;

      const el = scrollContainerRef.current;
      if (!el) return;
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia(PREFERS_REDUCED_MOTION_QUERY).matches;
      const targetIndex = isMobile
        ? scrollToFirstFutureIndex
        : scrollToLiveIndex;
      let offsetPx = 0;
      for (let i = 0; i < targetIndex; i++) {
        offsetPx += slots[i]?.size ?? cardSlotSize;
      }
      const targetScrollLeft = Math.max(0, offsetPx - SCROLL_EDGE_OFFSET_PX);
      const delay = 100;
      const t = setTimeout(() => {
        el.scrollTo({
          left: targetScrollLeft,
          behavior: reduceMotion ? "auto" : "smooth",
        });
      }, delay);
      return () => clearTimeout(t);
    }, [
      flowItems,
      firstFutureIndex,
      isMobile,
      scrollToLiveIndex,
      scrollToFirstFutureIndex,
      slots,
      cardSlotSize,
    ]);

    const renderSlotContent = useCallback(
      (
        slot: FlowSlot,
        virtualColumnIndex: number,
        isInViewport: boolean
      ): ReactNode => {
        const focusableTabIndex = isInViewport ? undefined : -1;
        if (slot.type === SLOT_PAST_SENTINEL) {
          return (
            <div className="flex min-w-0 flex-1 items-center justify-center">
              {isLoadingMorePast ? (
                <span className="text-text-secondary text-sm">
                  {LOADING_LABEL}
                </span>
              ) : (
                <span className="text-text-secondary text-sm" aria-hidden>
                  •
                </span>
              )}
            </div>
          );
        }
        if (slot.type === SLOT_FUTURE_SENTINEL) {
          return (
            <div className="flex min-w-0 flex-1 items-center justify-center">
              {isLoadingMoreFuture ? (
                <span className="text-text-secondary text-sm">
                  {LOADING_LABEL}
                </span>
              ) : (
                <span className="text-text-secondary text-sm" aria-hidden>
                  •
                </span>
              )}
            </div>
          );
        }
        if (slot.type === SLOT_CTA) {
          return (
            <div className="flex flex-shrink-0 items-stretch px-0.5">
              <Link
                to="/dashboard/compose?type=post"
                tabIndex={focusableTabIndex}
                className="focus-ring card-lift border-border-subtle bg-surface hover:bg-surface-hover/30 shadow-1 flex h-[200px] w-[280px] flex-shrink-0 flex-row items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed md:h-[232px] md:w-[352px]"
                aria-label="Open composer"
              >
                <Plus
                  className="text-text-secondary h-12 w-12 md:h-14 md:w-14"
                  aria-hidden
                />
                <div className="flex flex-col items-start gap-0.5 text-left">
                  <span className="text-text font-semibold">Open composer</span>
                  <span className="text-text-secondary/90 text-sm">
                    Schedule or publish
                  </span>
                </div>
              </Link>
            </div>
          );
        }
        if (slot.item) {
          const firstFutureOffset = hasMorePast ? 1 : 0;
          const goLive = getGoLiveAt(slot.item);
          const minutesUntil =
            goLive > nowMs ? Math.round((goLive - nowMs) / 60000) : undefined;
          return (
            <div className="flex flex-shrink-0 items-stretch px-0.5">
              <FlowCard
                item={slot.item}
                onClick={() => onCardClick(slot.item!)}
                isLastPosted={
                  firstFutureIndex >= 1 &&
                  virtualColumnIndex ===
                    firstFutureOffset + firstFutureIndex - 1
                    ? true
                    : undefined
                }
                isNextScheduled={
                  virtualColumnIndex === firstFutureOffset + firstFutureIndex
                }
                minutesUntil={minutesUntil}
                nowMs={nowMs}
                tabIndex={focusableTabIndex}
              />
            </div>
          );
        }
        return null;
      },
      [
        isLoadingMorePast,
        isLoadingMoreFuture,
        hasMorePast,
        firstFutureIndex,
        nowMs,
        onCardClick,
      ]
    );

    if (flowItems.length === 0) {
      if (isPostActivationEmpty) {
        return (
          <div
            className="border-border-subtle flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center"
            role="region"
            aria-label="Post timeline"
          >
            <h3 className="text-text text-base font-semibold">
              Schedule your first post
            </h3>
            <p className="text-text-secondary/90 max-w-xl text-sm">
              You&apos;ve started. Once content is scheduled, your flow appears
              here.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                to="/dashboard/compose?type=post"
                className="focus-ring bg-brand text-brand-on hover:bg-brand/90 rounded-xl px-4 py-2 text-sm font-medium"
              >
                Schedule first post
              </Link>
              <Link
                to="/dashboard/compose"
                className="focus-ring card-lift border-border-subtle text-text hover:bg-surface-hover/50 shadow-1 rounded-xl border px-4 py-2 text-sm font-medium"
              >
                Open composer
              </Link>
            </div>
          </div>
        );
      }
      return (
        <div
          className="border-border-subtle rounded-xl border border-dashed"
          role="region"
          aria-label="Post timeline"
        >
          <EmptyState
            title="No posts yet"
            description="Create your first post or schedule one to see your flow."
            action={
              <Link
                to="/dashboard/compose?type=post"
                className="focus-ring card-lift border-border-subtle text-text hover:bg-surface-hover/50 shadow-1 rounded-xl border px-4 py-2 text-sm font-medium"
              >
                Open composer
              </Link>
            }
          />
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
          className="scrollbar-hide min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain py-4"
          style={{
            height: isMobile
              ? CARD_MIN_HEIGHT_MOBILE + 32
              : CARD_MIN_HEIGHT + 36,
            contain: "layout",
          }}
        >
          <div
            role="presentation"
            style={{
              transform: `translateX(${overscrollPx}px)`,
              transition: isOverscrollSpringing
                ? `transform ${OVERSCROLL_SPRING_MS}ms ${OVERSCROLL_SPRING_CURVE}`
                : "none",
              willChange:
                overscrollPx !== 0 || isOverscrollSpringing
                  ? "transform"
                  : "auto",
              height: "100%",
              minHeight: isMobile ? CARD_MIN_HEIGHT_MOBILE : CARD_MIN_HEIGHT,
              width: rowVirtualizer.getTotalSize(),
              position: "relative",
              minWidth: "100%",
            }}
            onTransitionEnd={onOverscrollTransitionEnd}
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

              const viewportRight =
                scrollViewport.scrollLeft + scrollViewport.clientWidth;
              const slotLeft = virtualColumn.start;
              const slotRight = virtualColumn.start + virtualColumn.size;
              const isInViewport =
                slotRight > scrollViewport.scrollLeft &&
                slotLeft < viewportRight;

              return (
                <div
                  key={virtualColumn.key}
                  className="flow-slot"
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
                    alignItems: "center",
                  }}
                >
                  {renderSlotContent(slot, virtualColumn.index, isInViewport)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

FlowViewInner.displayName = "FlowView";

export const FlowView = FlowViewInner;
