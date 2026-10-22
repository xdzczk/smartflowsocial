import { describe, expect, it } from "vitest";

import {
  buildCalendarPastRangePath,
  CALENDAR_PAST_RANGE_MAX_MS,
  getCalendarVisibleRange,
  getPreviousCalendarAnchor,
  parseCalendarPastRangeSearch,
  pastRangeNeedsFetch,
  type CalendarSeedWindow,
} from "~/features/posts/calendar/calendar-past-range";
import { fromISOString } from "~/lib/temporal";

const RIGA = "Europe/Riga";
const OCT_22 = new Date(Date.UTC(2026, 9, 22, 12, 0, 0));
const DAY_MS = 24 * 60 * 60 * 1000;

function seedEnding(nowMs: number): CalendarSeedWindow {
  return { startMs: nowMs - 30 * DAY_MS, endMs: nowMs };
}

describe("calendar visible past range", () => {
  it("starts the October 2026 month grid on Monday 28 September in Riga", () => {
    const range = getCalendarVisibleRange("month", OCT_22, RIGA);
    const start = fromISOString(range.start, RIGA);
    const end = fromISOString(range.end, RIGA);

    expect(start.year).toBe(2026);
    expect(start.month).toBe(9);
    expect(start.day).toBe(28);
    expect(start.hour).toBe(0);
    expect(start.minute).toBe(0);

    expect(end.year).toBe(2026);
    expect(end.month).toBe(11);
    expect(end.day).toBe(8);
    expect(end.hour).toBe(23);
    expect(end.minute).toBe(59);
    expect(end.second).toBe(59);
    expect(range.endMs - range.startMs).toBeLessThanOrEqual(
      CALENDAR_PAST_RANGE_MAX_MS
    );
  });

  it("covers the Riga week of 22 October as Monday through Sunday", () => {
    const range = getCalendarVisibleRange("week", OCT_22, RIGA);
    const start = fromISOString(range.start, RIGA);
    const end = fromISOString(range.end, RIGA);

    expect(start.month).toBe(10);
    expect(start.day).toBe(19);
    expect(start.hour).toBe(0);
    expect(end.month).toBe(10);
    expect(end.day).toBe(25);
    expect(end.hour).toBe(23);
  });

  it("covers a single user-timezone day", () => {
    const range = getCalendarVisibleRange("day", OCT_22, RIGA);
    const start = fromISOString(range.start, RIGA);
    const end = fromISOString(range.end, RIGA);

    expect(start.day).toBe(22);
    expect(start.hour).toBe(0);
    expect(end.day).toBe(22);
    expect(end.hour).toBe(23);
  });

  it("steps backward the same way the toolbar does", () => {
    const previousMonth = fromISOString(
      getPreviousCalendarAnchor("month", OCT_22, RIGA).toISOString(),
      RIGA
    );
    const previousWeek = fromISOString(
      getPreviousCalendarAnchor("week", OCT_22, RIGA).toISOString(),
      RIGA
    );
    const previousDay = fromISOString(
      getPreviousCalendarAnchor("day", OCT_22, RIGA).toISOString(),
      RIGA
    );

    expect(previousMonth.month).toBe(9);
    expect(previousMonth.day).toBe(22);
    expect(previousWeek.month).toBe(10);
    expect(previousWeek.day).toBe(15);
    expect(previousDay.day).toBe(21);
  });

  it("skips a fetch when the visible past days sit inside the 30-day seed", () => {
    const nowMs = OCT_22.getTime();
    const week = getCalendarVisibleRange("week", OCT_22, RIGA);

    expect(pastRangeNeedsFetch(week, seedEnding(nowMs), nowMs)).toBe(false);
  });

  it("fetches a month the seed does not reach", () => {
    const nowMs = OCT_22.getTime();
    const august = getCalendarVisibleRange(
      "month",
      new Date(Date.UTC(2026, 7, 15, 12, 0, 0)),
      RIGA
    );

    expect(pastRangeNeedsFetch(august, seedEnding(nowMs), nowMs)).toBe(true);
  });

  it("fetches the current month when leading days fall before the seed", () => {
    const nowMs = Date.UTC(2026, 9, 29, 12, 0, 0);
    const october = getCalendarVisibleRange("month", new Date(nowMs), RIGA);

    expect(pastRangeNeedsFetch(october, seedEnding(nowMs), nowMs)).toBe(true);
  });

  it("does not fetch a range that is entirely in the future", () => {
    const nowMs = OCT_22.getTime();
    const march = getCalendarVisibleRange(
      "month",
      new Date(Date.UTC(2027, 2, 15, 12, 0, 0)),
      RIGA
    );

    expect(pastRangeNeedsFetch(march, seedEnding(nowMs), nowMs)).toBe(false);
    expect(pastRangeNeedsFetch(march, null, nowMs)).toBe(false);
  });

  it("fetches when there is no seed and the range is not entirely in the future", () => {
    const nowMs = OCT_22.getTime();
    const week = getCalendarVisibleRange("week", OCT_22, RIGA);

    expect(pastRangeNeedsFetch(week, null, nowMs)).toBe(true);
  });

  it("parses a visible-range request and rejects ranges the grid cannot show", () => {
    const month = getCalendarVisibleRange("month", OCT_22, RIGA);
    const path = buildCalendarPastRangePath("memes", month);
    const parsed = parseCalendarPastRangeSearch(
      new URLSearchParams(path.split("?")[1] ?? "")
    );

    expect(parsed).toEqual({
      kind: "range",
      start: new Date(month.startMs),
      end: new Date(month.endMs),
    });

    expect(parseCalendarPastRangeSearch(new URLSearchParams())).toEqual({
      kind: "full",
    });
    expect(
      parseCalendarPastRangeSearch(new URLSearchParams("pastRange=1"))
    ).toEqual({ kind: "invalid" });
    expect(
      parseCalendarPastRangeSearch(
        new URLSearchParams(
          "pastRange=1&from=2026-10-22&to=2026-10-23T00:00:00.000Z"
        )
      )
    ).toEqual({ kind: "invalid" });

    const start = new Date("2026-01-01T00:00:00.000Z");
    const tooWide = new URLSearchParams({
      pastRange: "1",
      from: start.toISOString(),
      to: new Date(
        start.getTime() + CALENDAR_PAST_RANGE_MAX_MS + 1
      ).toISOString(),
    });
    expect(parseCalendarPastRangeSearch(tooWide)).toEqual({ kind: "invalid" });

    const inverted = new URLSearchParams({
      pastRange: "1",
      from: "2026-10-22T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z",
    });
    expect(parseCalendarPastRangeSearch(inverted)).toEqual({ kind: "invalid" });
  });
});
