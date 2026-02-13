import { Link } from "@remix-run/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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

/** Rubber-band overscroll: iOS-like stretch (max pull and resistance tuned to feel like native iOS elastic) */
const OVERSCROLL_MAX_PX = 180;
const OVERSCROLL_RESISTANCE = 0.65;
/** Spring-back: slightly longer + gentle overshoot for buttery iOS-like feel */
const OVERSCROLL_SPRING_MS = 280;
const OVERSCROLL_SPRING_CURVE = "cubic-bezier(0.33, 1.1, 0.64, 1)";
/** Delay (ms) after last gesture before spring-back when overscroll is small (slow drag) */
const OVERSCROLL_SPRING_BACK_DELAY_SLOW_MS = 140;
/** When overscroll exceeds this (px), use 0ms delay so fast/far pull springs back immediately */
const OVERSCROLL_SPRING_BACK_FAST_THRESHOLD_PX = 40;
/** Edge threshold (px); wider so Chrome/macOS and sub-pixel scroll still trigger overscroll */
const OVERSCROLL_EDGE_PX = 16;

/** Inset (px) from left edge for initial position and "Scroll to next": last-posted card sits away from sidebar */
const SCROLL_EDGE_OFFSET_PX = 24;

const LOADING_LABEL = "Loading…";

const SLOT_PAST_SENTINEL = "past-sentinel";
const SLOT_FUTURE_SENTINEL = "future-sentinel";
const SLOT_CTA = "cta";

const NOW_MS = () => Date.now();

export function getGoLiveAt(item: CombinedContent): number {
  const posted = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
  const scheduled = item.scheduledAtUtc
    ? new Date(item.scheduledAtUtc).getTime()
    : 0;
  return posted || scheduled || 0;
}

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

/** Throttle (ms) for scrollViewport state updates to avoid re-renders every frame during scroll */
const SCROLL_VIEWPORT_THROTTLE_MS = 120;
/** Delay (ms) after past sentinel visible before fetching; avoids fetch burst during fast scroll */
const PAST_FETCH_DEBOUNCE_MS = 150;

/** rootMargin to trigger past/future fetch before sentinel is at the edge (prefetch) */
const SENTINEL_PREFETCH_ROOT_MARGIN_PX = 400;
/** When within this many px of the right edge, trigger future fetch (scroll-based; future sentinel may not be in DOM). */
const RIGHT_EDGE_FETCH_THRESHOLD_PX = 600;
/** Also trigger when within one viewport width of the right (catches wide viewports). */
const RIGHT_EDGE_VIEWPORT_MULTIPLIER = 1;

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
}

export interface FlowViewHandle {
  /** On mobile scrolls to next scheduled (first future); on desktop to live edge (last past + first future) */
  scrollToNext: () => void;
  /** Reset horizontal scroll to initial position (e.g. when queue filter changes). */
  scrollToInitial: () => void;
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
    /** Id of the item that was the first future (next scheduled) last render; used to detect when it gets published and trigger smooth scroll */
    const prevFirstFutureIdRef = useRef<string | null>(null);
    /** Rubber-band overscroll offset (px); negative = pulled from left, positive = from right */
    const [overscrollPx, setOverscrollPx] = useState(0);
    const [isOverscrollSpringing, setIsOverscrollSpringing] = useState(false);
    const overscrollPxRef = useRef(0);
    const overscrollRafIdRef = useRef<number | null>(null);
    const springBackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const rubberBandWrapperRef = useRef<HTMLDivElement | null>(null);
    const touchStartXRef = useRef(0);
    const pointerStartXRef = useRef(0);
    const pointerStartScrollLeftRef = useRef(0);
    /** Block load-more until initial scroll has had time; prevents request loop when scrollToIndex fails */
    const allowFetchRef = useRef(false);
    /** State so fetch effect re-runs when we allow fetch (ref alone doesn't trigger re-render) */
    const [allowFetch, setAllowFetch] = useState(false);
    /** On mobile: defer scroll compensation for prepended past until scroll has settled so we don't break momentum */
    const pendingPastCompensationRef = useRef<{
      delta: number;
      onDone?: () => void;
      fallbackId: ReturnType<typeof setTimeout>;
    } | null>(null);
    /** Only fetch past when we've scrolled away from left (initial scroll succeeded); prevents loop when stuck at scroll 0 */
    const hasScrolledAwayFromLeftRef = useRef(false);
    const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(
      null
    );
    /** Viewport for visibility: only items in this range get tabIndex (focusable). Avoids tabbing through entire virtual list. */
    const [scrollViewport, setScrollViewport] = useState({
      scrollLeft: 0,
      clientWidth: 2000,
    });
    const scrollViewportRafRef = useRef<number | null>(null);

    useEffect(() => {
      overscrollPxRef.current = overscrollPx;
    }, [overscrollPx]);

    // Throttle scrollViewport updates so we don't re-render every frame during scroll (reduces lag/flicker on mobile).
    const scrollViewportLastMsRef = useRef(0);
    const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    useEffect(() => {
      const el = scrollElement ?? scrollContainerRef.current;
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
          const pending = pendingPastCompensationRef.current;
          if (pending) {
            clearTimeout(pending.fallbackId);
            pendingPastCompensationRef.current = null;
            const container = scrollContainerRef.current;
            if (container) {
              container.scrollLeft += pending.delta;
            }
            pending.onDone?.();
          }
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

    const scheduleOverscrollSpringBack = useCallback(() => {
      if (springBackTimeoutRef.current)
        clearTimeout(springBackTimeoutRef.current);
      const delay =
        Math.abs(overscrollPxRef.current) >=
        OVERSCROLL_SPRING_BACK_FAST_THRESHOLD_PX
          ? 0
          : OVERSCROLL_SPRING_BACK_DELAY_SLOW_MS;
      springBackTimeoutRef.current = setTimeout(() => {
        springBackTimeoutRef.current = null;
        const current = overscrollPxRef.current;
        if (current !== 0) {
          if (overscrollRafIdRef.current !== null) {
            cancelAnimationFrame(overscrollRafIdRef.current);
            overscrollRafIdRef.current = null;
          }
          setOverscrollPx(current);
          requestAnimationFrame(() => {
            setIsOverscrollSpringing(true);
            setOverscrollPx(0);
          });
        }
      }, delay);
    }, []);

    // Rubber-band overscroll: depend on scrollElement so we attach when the scroll container exists.
    // 1) Document-level wheel in capture so we see events before Chrome/macOS native rubber-band (Chrome may not target our div).
    // 2) Pointer events for click-and-drag overscroll (works when wheel doesn't fire deltaX).
    useEffect(() => {
      const el = scrollElement ?? scrollContainerRef.current;
      if (!el) return;

      const applyOverscroll = (deltaX: number) => {
        const current = overscrollPxRef.current;
        const next =
          deltaX < 0
            ? Math.min(
                OVERSCROLL_MAX_PX,
                current - deltaX * OVERSCROLL_RESISTANCE
              )
            : Math.max(
                -OVERSCROLL_MAX_PX,
                current - deltaX * OVERSCROLL_RESISTANCE
              );
        overscrollPxRef.current = next;
        overscrollRafIdRef.current ??= requestAnimationFrame(() => {
          overscrollRafIdRef.current = null;
          setOverscrollPx(overscrollPxRef.current);
        });
        scheduleOverscrollSpringBack();
      };

      const handleWheel = (e: WheelEvent) => {
        const target = e.target as Node;
        if (!el.contains(target)) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
        const atLeft = scrollLeft <= OVERSCROLL_EDGE_PX;
        const atRight =
          maxScrollLeft <= OVERSCROLL_EDGE_PX ||
          scrollLeft >= maxScrollLeft - OVERSCROLL_EDGE_PX;
        const deltaX = e.deltaX;
        if (deltaX === 0) return;
        if (atLeft && deltaX < 0) {
          e.preventDefault();
          e.stopPropagation();
          if (el.scrollLeft > 0) el.scrollLeft = 0;
          applyOverscroll(deltaX);
        } else if (atRight && deltaX > 0) {
          e.preventDefault();
          e.stopPropagation();
          if (el.scrollLeft < maxScrollLeft) el.scrollLeft = maxScrollLeft;
          applyOverscroll(deltaX);
        }
      };

      const handlePointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        pointerStartXRef.current = e.clientX;
        pointerStartScrollLeftRef.current = el.scrollLeft;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
        const atLeft = scrollLeft <= OVERSCROLL_EDGE_PX;
        const atRight =
          maxScrollLeft <= OVERSCROLL_EDGE_PX ||
          scrollLeft >= maxScrollLeft - OVERSCROLL_EDGE_PX;
        if (atLeft || atRight) {
          el.setPointerCapture(e.pointerId);
        }
      };

      const handlePointerMove = (e: PointerEvent) => {
        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
        const atLeft = scrollLeft <= OVERSCROLL_EDGE_PX;
        const atRight =
          maxScrollLeft <= OVERSCROLL_EDGE_PX ||
          scrollLeft >= maxScrollLeft - OVERSCROLL_EDGE_PX;
        const deltaX = e.clientX - pointerStartXRef.current;
        if (atLeft && deltaX > 0) {
          e.preventDefault();
          if (el.scrollLeft > 0) el.scrollLeft = 0;
          applyOverscroll(-deltaX);
          pointerStartXRef.current = e.clientX;
        } else if (atRight && deltaX < 0) {
          e.preventDefault();
          if (el.scrollLeft < maxScrollLeft) el.scrollLeft = maxScrollLeft;
          applyOverscroll(-deltaX);
          pointerStartXRef.current = e.clientX;
        }
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (el.hasPointerCapture(e.pointerId)) {
          el.releasePointerCapture(e.pointerId);
        }
        if (overscrollPxRef.current !== 0) {
          setIsOverscrollSpringing(true);
          requestAnimationFrame(() => setOverscrollPx(0));
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
          if (el.scrollLeft > 0) el.scrollLeft = 0;
          const next = Math.min(
            OVERSCROLL_MAX_PX,
            current + moveX * OVERSCROLL_RESISTANCE
          );
          overscrollPxRef.current = next;
          overscrollRafIdRef.current ??= requestAnimationFrame(() => {
            overscrollRafIdRef.current = null;
            setOverscrollPx(overscrollPxRef.current);
          });
          scheduleOverscrollSpringBack();
        } else if (atRight && moveX < 0) {
          if (el.scrollLeft < maxScrollLeft) el.scrollLeft = maxScrollLeft;
          const next = Math.max(
            -OVERSCROLL_MAX_PX,
            current + moveX * OVERSCROLL_RESISTANCE
          );
          overscrollPxRef.current = next;
          overscrollRafIdRef.current ??= requestAnimationFrame(() => {
            overscrollRafIdRef.current = null;
            setOverscrollPx(overscrollPxRef.current);
          });
          scheduleOverscrollSpringBack();
        }
      };

      const handleTouchEnd = () => {
        if (overscrollPxRef.current !== 0) {
          setIsOverscrollSpringing(true);
          requestAnimationFrame(() => setOverscrollPx(0));
        }
      };

      const wheelOpts: AddEventListenerOptions = {
        passive: false,
        capture: true,
      };
      document.addEventListener("wheel", handleWheel, wheelOpts);
      el.addEventListener("pointerdown", handlePointerDown, { passive: true });
      el.addEventListener("pointermove", handlePointerMove, {
        passive: false,
      });
      el.addEventListener("pointerup", handlePointerUp, { passive: true });
      el.addEventListener("pointercancel", handlePointerUp, { passive: true });
      el.addEventListener("touchstart", handleTouchStart, { passive: true });
      el.addEventListener("touchmove", handleTouchMove, { passive: true });
      el.addEventListener("touchend", handleTouchEnd, { passive: true });

      return () => {
        document.removeEventListener("wheel", handleWheel, wheelOpts);
        el.removeEventListener("pointerdown", handlePointerDown);
        el.removeEventListener("pointermove", handlePointerMove);
        el.removeEventListener("pointerup", handlePointerUp);
        el.removeEventListener("pointercancel", handlePointerUp);
        el.removeEventListener("touchstart", handleTouchStart);
        el.removeEventListener("touchmove", handleTouchMove);
        el.removeEventListener("touchend", handleTouchEnd);
        if (overscrollRafIdRef.current !== null)
          cancelAnimationFrame(overscrollRafIdRef.current);
        if (springBackTimeoutRef.current)
          clearTimeout(springBackTimeoutRef.current);
      };
    }, [scheduleOverscrollSpringBack, scrollElement]);

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
    // On mobile, defer compensation until scroll has settled so we don't interrupt smooth scroll (momentum).
    useLayoutEffect(() => {
      if (lastPrependedPastCount <= 0) return;
      const el = scrollContainerRef.current;
      if (!el) return;
      const delta = lastPrependedPastCount * cardSlotSize;
      const applyCompensation = () => {
        if (!scrollContainerRef.current) return;
        scrollContainerRef.current.scrollLeft += delta;
        onPrependedPastCompensated?.();
      };
      if (isMobile) {
        if (pendingPastCompensationRef.current) {
          clearTimeout(pendingPastCompensationRef.current.fallbackId);
        }
        const fallbackId = setTimeout(() => {
          pendingPastCompensationRef.current = null;
          applyCompensation();
        }, 350);
        pendingPastCompensationRef.current = {
          delta,
          onDone: onPrependedPastCompensated,
          fallbackId,
        };
        return () => {
          if (pendingPastCompensationRef.current?.fallbackId === fallbackId) {
            clearTimeout(fallbackId);
            pendingPastCompensationRef.current = null;
          }
        };
      }
      applyCompensation();
    }, [
      lastPrependedPastCount,
      cardSlotSize,
      onPrependedPastCompensated,
      isMobile,
    ]);

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
        if (offsetId !== null) clearTimeout(offsetId);
        clearTimeout(allowId);
        clearTimeout(checkScrollId);
        clearTimeout(fallbackId);
      };
    }, [flowItems.length, hasLiveEdge, initialScrollIndex, rowVirtualizer]);

    // Scroll: (1) mark scrolled away from left for past-fetch; (2) trigger future-fetch when near right edge (future sentinel may not be in DOM due to virtualizer).
    // Poll when we can load more future; read scroll container from ref each time so dimensions are fresh.
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
      scrollElement,
      allowFetch,
      hasMoreFuture,
      isLoadingMoreFuture,
      onFetchMoreFuture,
    ]);

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
      const el = scrollContainerRef.current;
      if (!el) return;
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // When no scheduled posts, scroll to Flow Card CTA (last slot); otherwise to next/live edge
      const index = hasLiveEdge
        ? isMobile
          ? scrollToFirstFutureIndex
          : scrollToLiveIndex
        : slots.length - 1; /* CTA slot */
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
      hasLiveEdge,
      isMobile,
      scrollToFirstFutureIndex,
      scrollToLiveIndex,
      slots,
      cardSlotSize,
    ]);

    const handleScrollToInitial = useCallback(() => {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollLeft = 0;
      }
      rowVirtualizer.scrollToIndex(0, { align: "start", behavior: "auto" });
    }, [rowVirtualizer]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToNext: handleScrollToNext,
        scrollToInitial: handleScrollToInitial,
      }),
      [handleScrollToNext, handleScrollToInitial]
    );

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
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
                <span className="text-muted-foreground text-sm">
                  {LOADING_LABEL}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm" aria-hidden>
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
                <span className="text-muted-foreground text-sm">
                  {LOADING_LABEL}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm" aria-hidden>
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
                to="/dashboard/newpost"
                tabIndex={focusableTabIndex}
                className="card-lift border-border-subtle bg-card hover:bg-muted/30 focus:ring-ring flex h-[200px] w-[280px] flex-shrink-0 flex-row items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed shadow-sm focus:ring-2 focus:outline-none md:h-[232px] md:w-[352px]"
                aria-label="Create a new post"
              >
                <Plus
                  className="text-muted-foreground h-12 w-12 md:h-14 md:w-14"
                  aria-hidden
                />
                <div className="flex flex-col items-start gap-0.5 text-left">
                  <span className="text-foreground font-semibold">
                    Create new post
                  </span>
                  <span className="text-muted-foreground/90 text-sm">
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
      return (
        <div
          className="border-border-subtle flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-12 text-center"
          role="region"
          aria-label="Post timeline"
        >
          <p className="text-muted-foreground/90 text-sm">
            No posts yet. Create your first post or schedule one to see your
            flow.
          </p>
          <Link
            to="/dashboard/newpost"
            className="card-lift border-border-subtle text-foreground hover:bg-muted/50 focus:ring-ring rounded-xl border px-4 py-2 text-sm font-medium shadow-sm focus:ring-2 focus:outline-none"
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
          className="scrollbar-hide min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain py-4"
          style={{
            height: isMobile
              ? CARD_MIN_HEIGHT_MOBILE + 32
              : CARD_MIN_HEIGHT + 36,
            contain: "layout",
          }}
        >
          <div
            ref={rubberBandWrapperRef}
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
