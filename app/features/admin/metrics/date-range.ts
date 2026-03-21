/**
 * Admin dashboard date ranges: presets, bounds, and previous period for deltas.
 */

export type RangePreset = "24h" | "7d" | "30d" | "90d" | "all";

const PRESET_ORDER: RangePreset[] = ["24h", "7d", "30d", "90d", "all"];

export function isRangePreset(
  value: string | null | undefined
): value is RangePreset {
  return (
    value !== undefined &&
    value !== null &&
    PRESET_ORDER.includes(value as RangePreset)
  );
}

export function parseRangePreset(
  value: string | null | undefined,
  fallback: RangePreset
): RangePreset {
  return isRangePreset(value) ? value : fallback;
}

export interface DateRangeBounds {
  from: Date;
  to: Date;
}

/** Inclusive start, exclusive end semantics for DB queries: use `gte: from, lt: to` */
export function getBoundsForPreset(
  preset: RangePreset,
  now: Date
): DateRangeBounds {
  const to = new Date(now.getTime());
  if (preset === "all") {
    return { from: new Date(0), to };
  }
  const from = new Date(to.getTime());
  switch (preset) {
    case "24h":
      from.setUTCDate(from.getUTCDate() - 1);
      break;
    case "7d":
      from.setUTCDate(from.getUTCDate() - 7);
      break;
    case "30d":
      from.setUTCDate(from.getUTCDate() - 30);
      break;
    case "90d":
      from.setUTCDate(from.getUTCDate() - 90);
      break;
    default:
      break;
  }
  return { from, to };
}

/** Previous window of same duration (for delta comparisons). */
export function getPreviousPeriodBounds(
  current: DateRangeBounds,
  _now: Date
): DateRangeBounds | null {
  if (current.from.getTime() === 0) return null;
  const durationMs = current.to.getTime() - current.from.getTime();
  if (durationMs <= 0) return null;
  const prevTo = new Date(current.from.getTime());
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { from: prevFrom, to: prevTo };
}

export function formatDeltaPercent(
  current: number,
  previous: number
): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

/** Default range when URL has no `range` query param (per tab). */
export function defaultRangeForAdminPath(pathname: string): RangePreset {
  if (pathname.includes("/admin/analytics")) return "30d";
  if (pathname.includes("/admin/operations")) return "24h";
  if (pathname.includes("/admin/referrals")) return "30d";
  if (pathname.includes("/admin/users")) return "30d";
  return "7d";
}
