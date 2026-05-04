/**
 * Rubber-band overscroll (horizontal) for the flow scroll container.
 * Listens for wheel, pointer, and touch at edges and applies resistance + spring-back.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  OVERSCROLL_EDGE_PX,
  OVERSCROLL_MAX_PX,
  OVERSCROLL_MIN_SCROLL_RANGE_PX,
  OVERSCROLL_RESISTANCE,
  OVERSCROLL_SPRING_BACK_DELAY_SLOW_MS,
  OVERSCROLL_SPRING_BACK_FAST_THRESHOLD_PX,
} from "../flow-view-constants";

/** Avoid capturing the pointer on the scroll container when the user is interacting with a link or control  -  capture breaks click/navigation on edge slots (e.g. Flow CTA → composer). */
function isFlowOverscrollPointerCaptureSafeTarget(
  target: EventTarget | null
): boolean {
  if (!(target instanceof Element)) return true;
  return !target.closest(
    'a[href], button, input, textarea, select, [role="button"], [role="link"]'
  );
}

export interface UseFlowViewOverscrollResult {
  overscrollPx: number;
  isOverscrollSpringing: boolean;
  onOverscrollTransitionEnd: (e: React.TransitionEvent) => void;
}

export function useFlowViewOverscroll(
  scrollElement: HTMLDivElement | null
): UseFlowViewOverscrollResult {
  const [overscrollPx, setOverscrollPx] = useState(0);
  const [isOverscrollSpringing, setIsOverscrollSpringing] = useState(false);
  const overscrollPxRef = useRef(0);
  const overscrollRafIdRef = useRef<number | null>(null);
  const springBackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pointerStartXRef = useRef(0);
  const pointerStartScrollLeftRef = useRef(0);
  const touchStartXRef = useRef(0);

  useEffect(() => {
    overscrollPxRef.current = overscrollPx;
  }, [overscrollPx]);

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

  useEffect(() => {
    const el = scrollElement;
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
      if (maxScrollLeft < OVERSCROLL_MIN_SCROLL_RANGE_PX) return;
      const atLeft = scrollLeft <= OVERSCROLL_EDGE_PX;
      const atRight = scrollLeft >= maxScrollLeft - OVERSCROLL_EDGE_PX;
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
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
      if (maxScrollLeft < OVERSCROLL_MIN_SCROLL_RANGE_PX) return;
      pointerStartXRef.current = e.clientX;
      pointerStartScrollLeftRef.current = el.scrollLeft;
      const atLeft = scrollLeft <= OVERSCROLL_EDGE_PX;
      const atRight = scrollLeft >= maxScrollLeft - OVERSCROLL_EDGE_PX;
      if (
        (atLeft || atRight) &&
        isFlowOverscrollPointerCaptureSafeTarget(e.target)
      ) {
        el.setPointerCapture(e.pointerId);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
      if (maxScrollLeft < OVERSCROLL_MIN_SCROLL_RANGE_PX) return;
      const atLeft = scrollLeft <= OVERSCROLL_EDGE_PX;
      const atRight = scrollLeft >= maxScrollLeft - OVERSCROLL_EDGE_PX;
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
      if (maxScrollLeft < OVERSCROLL_MIN_SCROLL_RANGE_PX) return;
      const atLeft = scrollLeft <= OVERSCROLL_EDGE_PX;
      const atRight = scrollLeft >= maxScrollLeft - OVERSCROLL_EDGE_PX;
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
    el.addEventListener("pointermove", handlePointerMove, { passive: false });
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

  const onOverscrollTransitionEnd = useCallback((e: React.TransitionEvent) => {
    if (e.propertyName === "transform") setIsOverscrollSpringing(false);
  }, []);

  return {
    overscrollPx,
    isOverscrollSpringing,
    onOverscrollTransitionEnd,
  };
}
