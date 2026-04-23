/**
 * Current time indicator line in the week/day time grid.
 */

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

export function CurrentTimeIndicator({
  user,
  weekDays,
}: CurrentTimeIndicatorProps) {
  const userTimezone = user?.timezone ?? "Etc/UTC";
  const nowZoned = nowInTimezone(userTimezone);
  const currentHour = nowZoned.hour;
  const currentMinutes = nowZoned.minute;

  const isTodayInWeek = weekDays.some((day) => {
    const dayZoned = fromDate(day, userTimezone);
    return (
      dayZoned.year === nowZoned.year &&
      dayZoned.month === nowZoned.month &&
      dayZoned.day === nowZoned.day
    );
  });

  if (!isTodayInWeek) return null;

  const minuteProgress = currentMinutes / 60;
  const topOffset =
    currentHour * 2 * ROW_HEIGHT_PX + minuteProgress * ROW_HEIGHT_PX * 2;

  return (
    <div
      className="bg-brand/90 pointer-events-none absolute right-0 left-16 h-0.5"
      style={{ top: `${topOffset}px`, zIndex: CURRENT_TIME_INDICATOR_Z }}
    >
      <div className="bg-brand absolute -top-1 -left-2 h-2.5 w-2.5 rounded-full" />
    </div>
  );
}
