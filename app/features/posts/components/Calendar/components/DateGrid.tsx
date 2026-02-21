/**
 * Reusable date grid: weekday header + 42 day cells.
 * Each cell looks up posts by dateKey (YYYY-MM-DD in user timezone) and calls getCellContent.
 */

import type React from "react";
import type { ReactNode } from "react";

import { fromDate } from "~/lib/temporal";

import type { CalendarPost } from "../PostBlock.types";

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export interface DateGridProps {
  calendarDays: CalendarDay[];
  postsByDate: Record<string, CalendarPost[]>;
  getCellContent: (
    dateKey: string,
    posts: CalendarPost[],
    dayInfo: CalendarDay
  ) => ReactNode;
  onDrop?: (e: React.DragEvent<HTMLDivElement>, date: Date) => void;
  weekdayLabels?: string[];
  userTimezone: string;
  /** Optional: cell wrapper class (e.g. mobile padding). */
  cellClassName?: (dayInfo: CalendarDay) => string;
}

const DEFAULT_WEEKDAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

export function DateGrid({
  calendarDays,
  postsByDate,
  getCellContent,
  onDrop,
  weekdayLabels = DEFAULT_WEEKDAY_LABELS,
  userTimezone,
  cellClassName,
}: DateGridProps) {
  return (
    <div className="flex h-full min-h-0 flex-col select-none">
      <div className="border-border/40 flex flex-shrink-0 border-b bg-[hsl(var(--calendar-surface-2-bg))]">
        {weekdayLabels.map((day) => (
          <div
            key={day}
            className="text-muted-foreground flex min-w-0 flex-1 items-center justify-center border-r px-2 py-1 text-center text-sm font-medium last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid h-0 min-h-0 flex-1 auto-rows-[minmax(7.5rem,1fr)] grid-cols-7 gap-0 overflow-auto">
        {calendarDays.map((dayInfo) => {
          const dayZoned = fromDate(dayInfo.date, userTimezone);
          const dateKey = `${dayZoned.year}-${String(dayZoned.month).padStart(2, "0")}-${String(dayZoned.day).padStart(2, "0")}`;
          const posts = postsByDate[dateKey] ?? [];
          const content = getCellContent(dateKey, posts, dayInfo);
          const cellClass =
            cellClassName?.(dayInfo) ??
            `border-border/40 flex min-h-[120px] flex-col border-r border-b last:border-r-0 px-2 py-1.5 ${
              dayInfo.isCurrentMonth
                ? "bg-[hsl(var(--calendar-surface-2-bg))]"
                : "bg-secondary/20"
            } ${dayInfo.isToday ? "ring-primary ring-1" : ""}`;

          return (
            <div
              key={dayInfo.date.toISOString()}
              role="gridcell"
              tabIndex={-1}
              className={cellClass}
              onDragOver={
                onDrop
                  ? (e) => {
                      e.preventDefault();
                    }
                  : undefined
              }
              onDrop={
                onDrop
                  ? (e) => {
                      e.preventDefault();
                      onDrop(e, dayInfo.date);
                    }
                  : undefined
              }
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
