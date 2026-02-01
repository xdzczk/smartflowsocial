import { Link } from "@remix-run/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";

import type { CombinedContent } from "../types";

import { FlowCard } from "./FlowCard";

const CARD_WIDTH = 220;
const GAP = 16;
const CARD_SLOT_SIZE = CARD_WIDTH + GAP;
const SENTINEL_WIDTH = 120 + GAP;

const LOADING_LABEL = "Loading…";

const SLOT_PAST_SENTINEL = "past-sentinel";
const SLOT_FUTURE_SENTINEL = "future-sentinel";

const NOW_MS = () => Date.now();

function getGoLiveAt(item: CombinedContent): number {
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
}

export function FlowView({
  flowItems,
  hasMorePast,
  hasMoreFuture,
  isLoadingMorePast = false,
  isLoadingMoreFuture = false,
  onCardClick,
  onFetchMorePast,
  onFetchMoreFuture,
}: FlowViewProps): React.ReactNode {
  const [nowMs] = useState(() => NOW_MS());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const initialScrollDoneRef = useRef(false);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
    null
  );
  const setScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    setScrollElement(node);
  }, []);

  const firstFutureIndex = flowItems.findIndex(
    (item) => getGoLiveAt(item) > nowMs
  );
  const pastCount = firstFutureIndex < 0 ? flowItems.length : firstFutureIndex;

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
    if (isPastSentinelVisible && hasMorePast && !isLoadingMorePast) {
      onFetchMorePast();
    }
  }, [isPastSentinelVisible, hasMorePast, isLoadingMorePast, onFetchMorePast]);

  useEffect(() => {
    if (isFutureSentinelVisible && hasMoreFuture && !isLoadingMoreFuture) {
      onFetchMoreFuture();
    }
  }, [
    isFutureSentinelVisible,
    hasMoreFuture,
    isLoadingMoreFuture,
    onFetchMoreFuture,
  ]);

  const hasLiveEdge = firstFutureIndex >= 0;
  const scrollToLiveIndex =
    firstFutureIndex <= 0 ? 0 : (hasMorePast ? 1 : 0) + firstFutureIndex - 1;

  // On first load, scroll so we show last past post + first future (live edge)
  useEffect(() => {
    if (
      initialScrollDoneRef.current ||
      flowItems.length === 0 ||
      !hasLiveEdge
    ) {
      return;
    }
    initialScrollDoneRef.current = true;
    const raf = requestAnimationFrame(() => {
      rowVirtualizer.scrollToIndex(scrollToLiveIndex, {
        align: "start",
        behavior: "auto",
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [flowItems.length, hasLiveEdge, scrollToLiveIndex, rowVirtualizer]);

  const handleScrollToLatest = useCallback(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rowVirtualizer.scrollToIndex(scrollToLiveIndex, {
      align: "start",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [scrollToLiveIndex, rowVirtualizer]);

  if (flowItems.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center"
        role="region"
        aria-label="Post timeline"
      >
        <p className="text-muted-foreground text-sm">
          No posts yet. Create your first post or schedule one to see your flow.
        </p>
        <Link
          to="/dashboard/newpost"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
        >
          Create post
        </Link>
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      className="flex w-full flex-col gap-4"
      role="region"
      aria-label="Post timeline: past and scheduled"
    >
      {hasLiveEdge ? (
        <div className="flex justify-end px-4">
          <button
            type="button"
            onClick={handleScrollToLatest}
            className="text-muted-foreground hover:text-foreground focus:ring-primary rounded text-xs underline focus:ring-2 focus:ring-offset-2 focus:outline-none"
            aria-label="Scroll timeline to latest posts"
          >
            Scroll to latest
          </button>
        </div>
      ) : null}
      <div
        ref={setScrollContainerRef}
        className="h-[260px] overflow-x-auto overflow-y-hidden pb-2"
      >
        <div
          style={{
            height: 252,
            width: rowVirtualizer.getTotalSize(),
            position: "relative",
            minWidth: "100%",
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
                      minutesUntil={(() => {
                        const goLive = getGoLiveAt(slot.item);
                        if (goLive <= nowMs) return;
                        return Math.round((goLive - nowMs) / 60000);
                      })()}
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
