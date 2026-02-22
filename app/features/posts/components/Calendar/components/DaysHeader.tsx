/**
 * Days header row for week/day time grid (weekday labels + dates).
 */

import { fromDate, nowInTimezone } from "~/lib/temporal";

import type { UserData } from "../../../types";

import { MOBILE_WEEK_DAY_COLUMN_WIDTH } from "./weekly-view-constants";

export interface DaysHeaderProps {
  weekDays: Date[];
  user?: UserData | null;
  dateLocale: "en-GB" | "en-US" | "sv";
  isMobile: boolean;
}

export function DaysHeader({
  weekDays,
  user,
  dateLocale,
  isMobile,
}: DaysHeaderProps) {
  const userTimezone = user?.timezone ?? "Etc/UTC";
  const todayZoned = nowInTimezone(userTimezone);

  return (
    <div className="border-border/40 flex flex-shrink-0 border-b bg-[hsl(var(--calendar-surface-2-bg))]">
      <div className="w-16 flex-shrink-0" />
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
            }
          : undefined;
        return (
          <div
            key={day.toISOString()}
            className={`border-border/30 flex items-center justify-center gap-1 border-r px-2 py-1 text-center last:border-r-0 ${
              isMobile ? "min-w-0 shrink-0" : "min-w-[3.5rem] flex-1"
            } ${isToday ? "border-l-primary bg-primary/5 border-l-2" : ""}`}
            style={mobileWeekColumnStyle}
          >
            <span className="text-muted-foreground text-xs font-normal">
              {day.toLocaleDateString(dateLocale, {
                weekday: "short",
                timeZone: userTimezone,
              })}
            </span>
            <span
              className={`text-sm leading-tight font-semibold ${
                isToday ? "text-primary" : "text-foreground"
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
