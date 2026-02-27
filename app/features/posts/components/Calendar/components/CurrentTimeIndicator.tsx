/**
 * Current time indicator line in the week/day time grid.
 */

import { fromDate, nowInTimezone } from "~/lib/temporal";

import type { UserData } from "../../../types";

import {
  CURRENT_TIME_INDICATOR_Z,
  ROW_HEIGHT_PX,
} from "./weekly-view-constants";

export interface CurrentTimeIndicatorProps {
  user?: UserData | null;
  weekDays: Date[];
  isMobile?: boolean;
}

export function CurrentTimeIndicator({
  user,
  weekDays,
  isMobile = false,
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
      className={`bg-primary/90 pointer-events-none absolute right-0 h-0.5 ${
        isMobile ? "left-0" : "left-16"
      }`}
      style={{ top: `${topOffset}px`, zIndex: CURRENT_TIME_INDICATOR_Z }}
    >
      <div className="bg-primary absolute -top-1 -left-2 h-2.5 w-2.5 rounded-full" />
    </div>
  );
}
