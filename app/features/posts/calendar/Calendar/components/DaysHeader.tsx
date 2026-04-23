/**
 * Days header row for week/day time grid (weekday labels + dates).
 */

import type { UserData } from "~/features/posts/types";
import { fromDate, nowInTimezone } from "~/lib/temporal";

import {
  CALENDAR_DAYS_HEADER_TIME_SPACER_Z,
  CALENDAR_DAYS_HEADER_Z,
  MOBILE_WEEK_DAY_COLUMN_WIDTH,
} from "./weekly-view-constants";

export interface DaysHeaderProps {
  weekDays: Date[];
  user?: UserData | null;
  dateLocale: "en-GB" | "en-US" | "en-CA";
  isMobile: boolean;
  showTimeSpacer?: boolean;
  stickyTop?: boolean;
}

export function DaysHeader({
  weekDays,
  user,
  dateLocale,
  isMobile,
  showTimeSpacer = true,
  stickyTop = true,
}: DaysHeaderProps) {
  const userTimezone = user?.timezone ?? "Etc/UTC";
  const todayZoned = nowInTimezone(userTimezone);

  return (
    <div
      data-calendar-days-header="true"
      className={`border-border/40 flex flex-shrink-0 border-b bg-[hsl(var(--calendar-surface-2-bg))] ${
        stickyTop ? "sticky top-0" : ""
      }`}
      style={{ zIndex: CALENDAR_DAYS_HEADER_Z }}
    >
      {showTimeSpacer ? (
        <div
          className="border-border/40 sticky left-0 w-16 flex-shrink-0 border-r bg-[hsl(var(--calendar-surface-2-bg))]"
          style={{ zIndex: CALENDAR_DAYS_HEADER_TIME_SPACER_Z }}
        />
      ) : null}
      {weekDays.map((day) => {
        const dayZoned = fromDate(day, userTimezone);
        const isToday =
          dayZoned.year === todayZoned.year &&
          dayZoned.month === todayZoned.month &&
          dayZoned.day === todayZoned.day;
        const mobileWeekColumnStyle = isMobile
          ? {
              width: MOBILE_WEEK_DAY_COLUMN_WIDTH,
              minWidth: MOBILE_WEEK_DAY_COLUMN_WIDTH,
              flex: "0 0 auto" as const,
              scrollSnapAlign: "start" as const,
            }
          : undefined;
        return (
          <div
            key={day.toISOString()}
            className={`border-border/30 flex items-center justify-center gap-1 border-r px-2 py-1 text-center last:border-r-0 ${
              isMobile ? "min-w-0 shrink-0" : "min-w-[3.5rem] flex-1"
            } ${isToday ? "bg-surface-selected border-l-brand border-l-2" : ""}`}
            style={mobileWeekColumnStyle}
          >
            <span className="text-text-secondary text-xs font-normal">
              {day.toLocaleDateString(dateLocale, {
                weekday: "short",
                timeZone: userTimezone,
              })}
            </span>
            <span
              className={`text-sm leading-tight font-semibold ${
                isToday ? "text-brand" : "text-text"
              }`}
            >
              {day.getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
