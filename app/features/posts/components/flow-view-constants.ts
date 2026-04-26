import { getFlowGoLiveAtMs } from "../flow-go-live-at";
import type { CombinedContent } from "../types";

/** Mobile breakpoint (px); below this we scroll to next scheduled on load */
export const MOBILE_BREAKPOINT_PX = 768;

export const CARD_WIDTH = 352;
export const GAP = 28;
export const CARD_SLOT_SIZE = CARD_WIDTH + GAP;
export const CARD_MIN_HEIGHT = 232;

/** Desktop dashboard: vertical chrome inside the horizontal Flow strip (pt-2.5 pb-2 + breathing room). */
export const FLOW_DESKTOP_SCROLL_CHROME_PX = 22;

/**
 * Dashboard desktop Flow cards: target width/height (~1.45–1.75), centered on {@link CARD_WIDTH}.
 */
export const FLOW_DESKTOP_DASHBOARD_CARD_ASPECT = 1.58;
/** Tallest card allowed on tall viewports; width/height must stay ≥ this ratio */
export const FLOW_DESKTOP_DASHBOARD_CARD_ASPECT_MIN = 1.45;
export const FLOW_DESKTOP_DASHBOARD_CARD_HEIGHT_MIN_PX = 210;
/** Normal desktop: card height cap (unchanged large-window look). */
export const FLOW_DESKTOP_DASHBOARD_CARD_HEIGHT_MAX_PX = 240;

/**
 * First desktop height band: modest vertical scaling (`lg` dashboard). Below this = baseline only.
 */
export const DASHBOARD_DESKTOP_TALL_VIEWPORT_MIN_PX = 960;

/**
 * Second band: stronger scaling for very tall / fullscreen desktop viewports.
 */
export const DASHBOARD_DESKTOP_VERY_TALL_VIEWPORT_MIN_PX = 1000;

/** @deprecated Use {@link DASHBOARD_DESKTOP_TALL_VIEWPORT_MIN_PX} */
export const TALL_DESKTOP_VIEWPORT_MIN_PX =
  DASHBOARD_DESKTOP_TALL_VIEWPORT_MIN_PX;

/**
 * Desktop dashboard Flow **card content** height (px): baseline stays compact; tall and
 * very-tall bands ramp modestly then more generously while keeping width/height ≥ ~1.45.
 */
export function getDashboardDesktopFlowCardContentHeightPx(
  viewportHeightPx?: number
): number {
  const raw = Math.round(CARD_WIDTH / FLOW_DESKTOP_DASHBOARD_CARD_ASPECT);
  const base = Math.min(
    FLOW_DESKTOP_DASHBOARD_CARD_HEIGHT_MAX_PX,
    Math.max(FLOW_DESKTOP_DASHBOARD_CARD_HEIGHT_MIN_PX, raw)
  );
  if (
    viewportHeightPx == null ||
    viewportHeightPx < DASHBOARD_DESKTOP_TALL_VIEWPORT_MIN_PX
  ) {
    return base;
  }
  const maxByAspect = Math.floor(
    CARD_WIDTH / FLOW_DESKTOP_DASHBOARD_CARD_ASPECT_MIN
  );
  const tallCardCeiling = Math.min(246, maxByAspect);

  if (viewportHeightPx < DASHBOARD_DESKTOP_VERY_TALL_VIEWPORT_MIN_PX) {
    const span =
      DASHBOARD_DESKTOP_VERY_TALL_VIEWPORT_MIN_PX -
      DASHBOARD_DESKTOP_TALL_VIEWPORT_MIN_PX;
    const t = Math.min(
      1,
      Math.max(
        0,
        (viewportHeightPx - DASHBOARD_DESKTOP_TALL_VIEWPORT_MIN_PX) / span
      )
    );
    const modestCeiling = Math.min(base + 5, tallCardCeiling);
    return Math.round(base + t * (modestCeiling - base));
  }

  const startVeryTall = Math.min(base + 5, tallCardCeiling);
  const t = Math.min(
    1,
    Math.max(
      0,
      (viewportHeightPx - DASHBOARD_DESKTOP_VERY_TALL_VIEWPORT_MIN_PX) / 450
    )
  );
  return Math.round(startVeryTall + t * (tallCardCeiling - startVeryTall));
}

/** Max card content height for generic desktop clamps (tall-safe upper bound). */
export const FLOW_DESKTOP_CARD_HEIGHT_MAX_PX = Math.min(
  246,
  Math.floor(CARD_WIDTH / FLOW_DESKTOP_DASHBOARD_CARD_ASPECT_MIN)
);

/**
 * Fallback when split-region measurement is unavailable.
 */
export function clampDashboardDesktopFlowCardHeightPx(
  viewportHeightPx: number
): number {
  return getDashboardDesktopFlowCardContentHeightPx(viewportHeightPx);
}

/** Mobile: smaller cards so ~1.3–1.5 cards visible; reduces "trapped" feel */
export const CARD_WIDTH_MOBILE = 280;
export const GAP_MOBILE = 20;
export const CARD_SLOT_SIZE_MOBILE = CARD_WIDTH_MOBILE + GAP_MOBILE;
export const CARD_MIN_HEIGHT_MOBILE = 200;

export const SENTINEL_WIDTH = 120 + GAP;

/** Rubber-band overscroll: iOS-like stretch */
export const OVERSCROLL_MAX_PX = 180;
export const OVERSCROLL_RESISTANCE = 0.65;
export const OVERSCROLL_SPRING_MS = 280;
export const OVERSCROLL_SPRING_CURVE = "cubic-bezier(0.33, 1.1, 0.64, 1)";
export const OVERSCROLL_SPRING_BACK_DELAY_SLOW_MS = 140;
export const OVERSCROLL_SPRING_BACK_FAST_THRESHOLD_PX = 40;
export const OVERSCROLL_EDGE_PX = 16;
export const OVERSCROLL_MIN_SCROLL_RANGE_PX = 20;

/** Inset (px) from left edge for initial position and "Scroll to next" */
export const SCROLL_EDGE_OFFSET_PX = 24;

/** Media query for user's reduced-motion preference */
export const PREFERS_REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const LOADING_LABEL = "Loading…";

export const SLOT_PAST_SENTINEL = "past-sentinel";
export const SLOT_FUTURE_SENTINEL = "future-sentinel";
export const SLOT_CTA = "cta";

/** Throttle (ms) for scrollViewport state updates */
export const SCROLL_VIEWPORT_THROTTLE_MS = 120;
/** Delay (ms) after past sentinel visible before fetching */
export const PAST_FETCH_DEBOUNCE_MS = 150;

/** rootMargin to trigger past/future fetch before sentinel is at the edge */
export const SENTINEL_PREFETCH_ROOT_MARGIN_PX = 400;
/** When within this many px of the right edge, trigger future fetch */
export const RIGHT_EDGE_FETCH_THRESHOLD_PX = 600;
/** Also trigger when within one viewport width of the right */
export const RIGHT_EDGE_VIEWPORT_MULTIPLIER = 1;

export function getGoLiveAt(item: CombinedContent): number {
  return getFlowGoLiveAtMs(item);
}
