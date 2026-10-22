/**
 * Visible calendar bounds for published-post fetches.
 *
 * Month matches MonthlyView: Monday-start, 42 days, user timezone.
 * Week matches WeeklyView's UTC columns, expanded to the user-timezone
 * days those columns display. Day is the anchor's user-timezone day.
 * Bounds are inclusive from local start-of-day through the last millisecond
 * of the last visible day.
 */

import {
  addDays,
  addMonths,
  createZonedDateTime,
  fromDate,
  startOfDay,
  toDate,
} from "~/lib/temporal";

export const CALENDAR_PAST_LOOKBACK_DAYS = 30;

/** Month grid is 42 days. 62 leaves room for a DST shift on that grid. */
export const CALENDAR_PAST_RANGE_MAX_MS = 62 * 24 * 60 * 60 * 1000;

export type CalendarRangeView = "day" | "week" | "month";

export interface CalendarInstantRange {
  start: string;
  end: string;
  startMs: number;
  endMs: number;
}

export interface CalendarSeedWindow {
  startMs: number;
  endMs: number;
}

export type CalendarPastRangeParse =
  | { kind: "full" }
  | { kind: "invalid" }
  | { kind: "range"; start: Date; end: Date };

function inclusiveRange(
  startZoned: ReturnType<typeof startOfDay>,
  endExclusiveZoned: ReturnType<typeof startOfDay>
): CalendarInstantRange {
  const startMs = toDate(startZoned).getTime();
  const endMs = toDate(endExclusiveZoned).getTime() - 1;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    startMs,
    endMs,
  };
}

function daysFromMonday(dayOfWeek: number): number {
  return dayOfWeek === 7 ? 6 : dayOfWeek - 1;
}

export function getCalendarVisibleRange(
  view: CalendarRangeView,
  anchor: Date,
  timeZone: string
): CalendarInstantRange {
  if (view === "month") {
    const currentZoned = fromDate(anchor, timeZone);
    const firstDay = createZonedDateTime(
      currentZoned.year,
      currentZoned.month,
      1,
      0,
      0,
      timeZone
    );
    const startZoned = addDays(firstDay, -daysFromMonday(firstDay.dayOfWeek));
    return inclusiveRange(startZoned, addDays(startZoned, 42));
  }

  if (view === "week") {
    const currentZoned = fromDate(anchor, "UTC");
    const weekStart = addDays(
      currentZoned,
      -daysFromMonday(currentZoned.dayOfWeek)
    );
    let earliest = fromDate(toDate(weekStart), timeZone);
    let latest = earliest;
    for (let i = 1; i < 7; i++) {
      const local = fromDate(toDate(addDays(weekStart, i)), timeZone);
      if (local.epochMilliseconds < earliest.epochMilliseconds) {
        earliest = local;
      }
      if (local.epochMilliseconds > latest.epochMilliseconds) {
        latest = local;
      }
    }
    const startZoned = startOfDay(earliest, timeZone);
    const endExclusive = addDays(startOfDay(latest, timeZone), 1);
    return inclusiveRange(startZoned, endExclusive);
  }

  const startZoned = startOfDay(fromDate(anchor, timeZone), timeZone);
  return inclusiveRange(startZoned, addDays(startZoned, 1));
}

/** Matches the calendar toolbar's previous-period step. */
export function getPreviousCalendarAnchor(
  view: CalendarRangeView,
  anchor: Date,
  timeZone: string
): Date {
  const currentZoned = fromDate(anchor, timeZone);
  const previous =
    view === "day"
      ? addDays(currentZoned, -1)
      : view === "week"
        ? addDays(currentZoned, -7)
        : addMonths(currentZoned, -1);
  return toDate(previous);
}

/**
 * Published posts are only needed for the part of the grid that is already
 * in the past. A range is covered when that past portion starts inside the
 * seed window. The seed end moves forward on the main calendar refetch.
 */
export function pastRangeNeedsFetch(
  visible: CalendarInstantRange,
  seed: CalendarSeedWindow | null,
  nowMs: number
): boolean {
  const pastEndMs = Math.min(visible.endMs, nowMs);
  if (pastEndMs < visible.startMs) return false;
  if (!seed) return true;
  return visible.startMs < seed.startMs;
}

export function rangeContainsNow(
  visible: CalendarInstantRange,
  nowMs: number
): boolean {
  return visible.startMs <= nowMs && nowMs <= visible.endMs;
}

export function calendarSeedWindowFromIso(
  window: { start: string; end: string } | null | undefined
): CalendarSeedWindow | null {
  if (!window) return null;
  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return { startMs, endMs };
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;

export function parseCalendarPastRangeSearch(
  params: URLSearchParams
): CalendarPastRangeParse {
  if (params.get("pastRange") !== "1") return { kind: "full" };

  const from = params.get("from");
  const to = params.get("to");
  if (
    !from ||
    !to ||
    from.length > 40 ||
    to.length > 40 ||
    !ISO_INSTANT.test(from) ||
    !ISO_INSTANT.test(to)
  ) {
    return { kind: "invalid" };
  }

  const startMs = Date.parse(from);
  const endMs = Date.parse(to);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { kind: "invalid" };
  }
  if (endMs < startMs || endMs - startMs > CALENDAR_PAST_RANGE_MAX_MS) {
    return { kind: "invalid" };
  }

  return { kind: "range", start: new Date(startMs), end: new Date(endMs) };
}

export function buildCalendarPastRangePath(
  queueType: string,
  range: Pick<CalendarInstantRange, "start" | "end">
): string {
  const params = new URLSearchParams({
    pastRange: "1",
    _loader: "json",
    from: range.start,
    to: range.end,
    queueType,
  });
  return `/dashboard/calendar?${params.toString()}`;
}
