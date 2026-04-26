import { useLayoutEffect, useRef, useState, type RefObject } from "react";

import { getDashboardDesktopFlowCardContentHeightPx } from "../components/flow-view-constants";
import { computeDashboardDesktopSplitHeights } from "../dashboard/dashboard-desktop-vertical-split";

const LG_MIN_WIDTH = "(min-width: 1024px)";
/** Tailwind `gap-4` between Flow zone and lower panels */
const SPLIT_STACK_GAP_PX = 16;

export interface DashboardDesktopLayoutHeights {
  splitRegionRef: RefObject<HTMLDivElement | null>;
  /** Outer Flow band (tinted zone); may exceed card+chrome for vertical breathing room */
  flowZoneHeightPx: number | undefined;
  /** Next 7 Days + Queues row height (px) */
  lowerRowHeightPx: number | undefined;
  /** Aspect-limited Flow card content height (px) for the desktop FlowView prop */
  desktopFlowCardHeightPx: number | undefined;
}

/**
 * Measures the dashboard Flow + lower-panels stack on `lg+` and assigns
 * bounded heights so both regions share viewport space without runaway flex growth.
 *
 * @param measureEnabled set false when the split region is not mounted (e.g. first-run dashboard).
 */
export function useDashboardDesktopLayoutHeights(
  measureEnabled: boolean
): DashboardDesktopLayoutHeights {
  const splitRegionRef = useRef<HTMLDivElement | null>(null);
  const [measuredHeights, setMeasuredHeights] = useState<{
    flowZonePx: number;
    lowerRowPx: number;
    viewportHeightPx: number;
  } | null>(null);

  const heights = measureEnabled ? measuredHeights : null;

  useLayoutEffect(() => {
    if (!measureEnabled) {
      return;
    }

    const mq = window.matchMedia(LG_MIN_WIDTH);

    const read = () => {
      const el = splitRegionRef.current;
      if (!mq.matches || !el) {
        setMeasuredHeights(null);
        return;
      }
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const gap = SPLIT_STACK_GAP_PX;
      const availableForRows = Math.max(0, el.clientHeight - gap);
      setMeasuredHeights({
        ...computeDashboardDesktopSplitHeights({
          availableForRowsPx: availableForRows,
          viewportHeightPx: vh,
        }),
        viewportHeightPx: vh,
      });
    };

    read();
    const el = splitRegionRef.current;
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => read())
        : null;
    if (el && ro) ro.observe(el);
    window.addEventListener("resize", read);
    mq.addEventListener("change", read);
    window.visualViewport?.addEventListener("resize", read);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", read);
      mq.removeEventListener("change", read);
      window.visualViewport?.removeEventListener("resize", read);
    };
  }, [measureEnabled]);

  if (!heights) {
    return {
      splitRegionRef,
      flowZoneHeightPx: undefined,
      lowerRowHeightPx: undefined,
      desktopFlowCardHeightPx: undefined,
    };
  }

  return {
    splitRegionRef,
    flowZoneHeightPx: heights.flowZonePx,
    lowerRowHeightPx: heights.lowerRowPx,
    desktopFlowCardHeightPx: getDashboardDesktopFlowCardContentHeightPx(
      heights.viewportHeightPx
    ),
  };
}
