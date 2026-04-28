/**
 * Current time indicator line in the week/day time grid.
 *
 * The "now" snapshot is subscribed to via `useSyncExternalStore` so that:
 *   - server render and first-client render both see `null` (no indicator),
 *     avoiding React hydration errors (#418/#423).
 *   - after hydration the client subscribes to a 30s interval and paints
 *     the indicator, which slides down as minutes pass.
 */

import { useSyncExternalStore } from "react";

import type { UserData } from "~/features/posts/types";
import { fromDate, nowInTimezone } from "~/lib/temporal";

import {
  CURRENT_TIME_INDICATOR_Z,
  ROW_HEIGHT_PX,
} from "./weekly-view-constants";

export interface CurrentTimeIndicatorProps {
  user?: UserData | null;
  weekDays: Date[];
  /**
   * @deprecated Indicator now always skips the sticky time rail (`left-16`).
   *             Retained for backwards compatibility with existing call sites.
   */
  isMobile?: boolean;
}

function subscribeMinute(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const id = window.setInterval(() => {
    onStoreChange();
  }, 30_000);
  return () => window.clearInterval(id);
}

function getNowKey(tz: string): string {
  const z = nowInTimezone(tz);
  return `${z.year}|${z.month}|${z.day}|${z.hour}|${z.minute}`;
}

function parseNowKey(key: string | null) {
  if (!key) return null;
  const parts = key.split("|").map((n) => Number(n));
  if (parts.length < 5) return null;
  const [y, mo, d, h, mi] = parts as [number, number, number, number, number];
  return { year: y, month: mo, day: d, hour: h, minute: mi };
}

export function CurrentTimeIndicator({
  user,
  weekDays,
}: CurrentTimeIndicatorProps) {
  const userTimezone = user?.timezone ?? "Etc/UTC";

  const nowKey = useSyncExternalStore(
    subscribeMinute,
    () => getNowKey(userTimezone),
    () => null
  );
  const now = parseNowKey(nowKey);

  if (!now) return null;

  const isTodayInWeek = weekDays.some((day) => {
    const dayZoned = fromDate(day, userTimezone);
    return (
      dayZoned.year === now.year &&
      dayZoned.month === now.month &&
      dayZoned.day === now.day
    );
  });

  if (!isTodayInWeek) return null;

  const minuteProgress = now.minute / 60;
  const topOffset =
    now.hour * 2 * ROW_HEIGHT_PX + minuteProgress * ROW_HEIGHT_PX * 2;

  return (
    <div
      className="bg-text-secondary/40 pointer-events-none absolute right-0 left-16 h-0.5"
      style={{ top: `${topOffset}px`, zIndex: CURRENT_TIME_INDICATOR_Z }}
    >
      <div className="bg-text-secondary absolute -top-1 -left-2 h-2.5 w-2.5 rounded-full" />
    </div>
  );
}
