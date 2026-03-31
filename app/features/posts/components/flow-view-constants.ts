import { getFlowGoLiveAtMs } from "../flow-go-live-at";
import type { CombinedContent } from "../types";

/** Mobile breakpoint (px); below this we scroll to next scheduled on load */
export const MOBILE_BREAKPOINT_PX = 768;

export const CARD_WIDTH = 352;
export const GAP = 28;
export const CARD_SLOT_SIZE = CARD_WIDTH + GAP;
export const CARD_MIN_HEIGHT = 232;

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
