import {
  DASHBOARD_DESKTOP_TALL_VIEWPORT_MIN_PX,
  DASHBOARD_DESKTOP_VERY_TALL_VIEWPORT_MIN_PX,
  FLOW_DESKTOP_SCROLL_CHROME_PX,
  getDashboardDesktopFlowCardContentHeightPx,
} from "../components/flow-view-constants";

/** Outer Flow scroll strip height (card + chrome) for a given viewport. */
export function getDashboardDesktopFlowScrollOuterHeightPx(
  viewportHeightPx: number
): number {
  return (
    getDashboardDesktopFlowCardContentHeightPx(viewportHeightPx) +
    FLOW_DESKTOP_SCROLL_CHROME_PX
  );
}

export const DASHBOARD_DESKTOP_LOWER_ROW_MIN_PX = 280;

/** When the viewport is shorter than both mins, lower row may shrink below {@link DASHBOARD_DESKTOP_LOWER_ROW_MIN_PX} after the flow zone hits its floor. */
const LOWER_ROW_SHRINK_FLOOR_PX = 240;

/** Desktop lower row ceiling (normal and tall; avoids lowering this at the tall threshold) */
export const DASHBOARD_DESKTOP_LOWER_ROW_MAX_PX = 372;

const FLOW_ZONE_PREF_VH = 0.25;
const LOWER_ROW_PREF_VH = 0.31;

/** Baseline desktop: max outer Flow zone (compact large-window fit) */
export const DASHBOARD_DESKTOP_FLOW_ZONE_MAX_PX = 332;

/** Tall band (960–999px vh): modest extra Flow zone height */
export const DASHBOARD_DESKTOP_FLOW_ZONE_MAX_TALL_PX = 348;

/** Very tall / fullscreen: Flow zone ceiling */
export const DASHBOARD_DESKTOP_FLOW_ZONE_MAX_VERY_TALL_PX = 388;

function applyVeryTallSlackDistribution(
  slackFloor: number,
  flowZoneMax: number,
  lowerMax: number,
  hFlowRef: { v: number },
  hLowerRef: { v: number }
): void {
  const n = Math.floor(slackFloor);
  for (let i = 0; i < n; i++) {
    const preferFlow = i % 5 < 3;
    let hFlow = hFlowRef.v;
    let hLower = hLowerRef.v;
    if (preferFlow && hFlow < flowZoneMax) {
      hFlow += 1;
    } else if (hLower < lowerMax) {
      hLower += 1;
    } else if (hFlow < flowZoneMax) {
      hFlow += 1;
    } else {
      break;
    }
    hFlowRef.v = hFlow;
    hLowerRef.v = hLower;
  }
}

function shrinkHeightsUntilFitInner(
  inner: number,
  flowZoneMin: number,
  hFlowRef: { v: number },
  hLowerRef: { v: number }
): void {
  let hFlow = hFlowRef.v;
  let hLower = hLowerRef.v;
  let guard = 0;
  while (hFlow + hLower > inner && guard++ < 2000) {
    if (hFlow > flowZoneMin) {
      hFlow -= 1;
    } else if (hLower > LOWER_ROW_SHRINK_FLOOR_PX) {
      hLower -= 1;
    } else {
      break;
    }
  }
  hFlowRef.v = hFlow;
  hLowerRef.v = hLower;
}

/**
 * Bounded split: Flow **zone** height vs lower row. Card height comes from
 * {@link getDashboardDesktopFlowCardContentHeightPx} (normal vs tall viewport).
 */
export function computeDashboardDesktopSplitHeights({
  availableForRowsPx,
  viewportHeightPx,
}: {
  availableForRowsPx: number;
  viewportHeightPx: number;
}): { flowZonePx: number; lowerRowPx: number } {
  const vh = viewportHeightPx;
  const inner = Math.max(0, availableForRowsPx);
  const isVeryTall = vh >= DASHBOARD_DESKTOP_VERY_TALL_VIEWPORT_MIN_PX;
  const isTallBand =
    vh >= DASHBOARD_DESKTOP_TALL_VIEWPORT_MIN_PX && !isVeryTall;
  const flowZoneMax = isVeryTall
    ? DASHBOARD_DESKTOP_FLOW_ZONE_MAX_VERY_TALL_PX
    : isTallBand
      ? DASHBOARD_DESKTOP_FLOW_ZONE_MAX_TALL_PX
      : DASHBOARD_DESKTOP_FLOW_ZONE_MAX_PX;
  const lowerMax = DASHBOARD_DESKTOP_LOWER_ROW_MAX_PX;

  const flowScrollOuter = getDashboardDesktopFlowScrollOuterHeightPx(vh);
  /** Flow band only needs to fit the strip; do not force it to match lower-row min (that hid ~10–14px from the Next 7 days row). */
  const flowZoneMin = flowScrollOuter;

  let hFlow = Math.round(
    Math.min(flowZoneMax, Math.max(flowZoneMin, vh * FLOW_ZONE_PREF_VH))
  );
  let hLower = Math.round(
    Math.min(
      lowerMax,
      Math.max(DASHBOARD_DESKTOP_LOWER_ROW_MIN_PX, vh * LOWER_ROW_PREF_VH)
    )
  );

  const sumMin = flowZoneMin + DASHBOARD_DESKTOP_LOWER_ROW_MIN_PX;

  if (inner < sumMin) {
    const hFlowRef = { v: flowZoneMin };
    const hLowerRef = { v: DASHBOARD_DESKTOP_LOWER_ROW_MIN_PX };
    shrinkHeightsUntilFitInner(inner, flowZoneMin, hFlowRef, hLowerRef);
    return {
      flowZonePx: hFlowRef.v,
      lowerRowPx: hLowerRef.v,
    };
  }

  if (hFlow + hLower <= inner) {
    let slack = inner - hFlow - hLower;
    if (isVeryTall) {
      const hFlowRef = { v: hFlow };
      const hLowerRef = { v: hLower };
      applyVeryTallSlackDistribution(
        slack,
        flowZoneMax,
        lowerMax,
        hFlowRef,
        hLowerRef
      );
      hFlow = hFlowRef.v;
      hLower = hLowerRef.v;
    } else {
      const growLower = (s: number) => {
        const add = Math.min(s, lowerMax - hLower);
        hLower += add;
        return s - add;
      };
      const growFlow = (s: number) => {
        const add = Math.min(s, flowZoneMax - hFlow);
        hFlow += add;
        return s - add;
      };
      slack = growLower(slack);
      slack = growFlow(slack);
      slack = growLower(slack);
      slack = growFlow(slack);
    }
    return { flowZonePx: hFlow, lowerRowPx: hLower };
  }

  let scale = inner / (hFlow + hLower);
  hFlow = Math.floor(hFlow * scale);
  hLower = Math.floor(hLower * scale);
  hFlow = Math.min(flowZoneMax, Math.max(flowZoneMin, hFlow));
  hLower = Math.min(
    lowerMax,
    Math.max(DASHBOARD_DESKTOP_LOWER_ROW_MIN_PX, hLower)
  );

  const hFlowRef = { v: hFlow };
  const hLowerRef = { v: hLower };
  shrinkHeightsUntilFitInner(inner, flowZoneMin, hFlowRef, hLowerRef);

  return {
    flowZonePx: hFlowRef.v,
    lowerRowPx: hLowerRef.v,
  };
}
