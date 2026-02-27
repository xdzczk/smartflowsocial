import { useMemo } from "react";

import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import {
  addDays,
  createZonedDateTime,
  fromDate,
  nowInTimezone,
  toDate,
} from "~/lib/temporal";

import type { QueueType, UserData } from "../../types";
import { CONTENT_MOBILE_BREAKPOINT_PX } from "../constants";

import {
  buildDropIsoString,
  isCalendarDropSlotInPast,
} from "./calendar-helpers";
import { DateGrid } from "./components/DateGrid";
import type { CalendarDay } from "./components/DateGrid";
import { parseDropToDateTime } from "./data/parse-drop-to-date-time";
import { postsToDateGrid } from "./data/posts-to-date-grid";
import type { PostsByDate } from "./data/posts-to-date-grid";
import { PostBlock } from "./PostBlock";
import type { CalendarPost } from "./PostBlock.types";
import { getDisplayTime } from "./PostBlock.utils";

interface MonthlyViewProps {
  scheduledPosts: CalendarPost[];
  pastPosts?: CalendarPost[];
  currentDate: Date;
  onPostDrop: (post: CalendarPost, newDateTime: Date) => void;
  onPostEdit: (post: CalendarPost) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
}

/** Slot placement in the 2×3 grid: row (0–2), col (0–1), colSpan (1 or 2). */
interface SlotPlacement {
  row: number;
  col: number;
  colSpan: number;
}

const MONTHLY_CELL_LAYOUTS: Array<Array<SlotPlacement | null>> = [
  [],
  [{ row: 0, col: 0, colSpan: 2 }],
  [
    { row: 0, col: 0, colSpan: 2 },
    { row: 1, col: 0, colSpan: 2 },
  ],
  [
    { row: 0, col: 0, colSpan: 2 },
    { row: 1, col: 0, colSpan: 2 },
    { row: 2, col: 0, colSpan: 2 },
  ],
  [
    { row: 0, col: 0, colSpan: 1 },
    { row: 0, col: 1, colSpan: 1 },
    { row: 1, col: 0, colSpan: 1 },
    { row: 1, col: 1, colSpan: 1 },
  ],
  [
    { row: 0, col: 0, colSpan: 1 },
    { row: 0, col: 1, colSpan: 1 },
    { row: 1, col: 0, colSpan: 1 },
    { row: 1, col: 1, colSpan: 1 },
    { row: 2, col: 0, colSpan: 2 },
  ],
  [
    { row: 0, col: 0, colSpan: 1 },
    { row: 0, col: 1, colSpan: 1 },
    { row: 1, col: 0, colSpan: 1 },
    { row: 1, col: 1, colSpan: 1 },
    { row: 2, col: 0, colSpan: 1 },
    { row: 2, col: 1, colSpan: 1 },
  ],
];

function getMonthlyCellLayout(count: number): Array<SlotPlacement | null> {
  if (count <= 0) return MONTHLY_CELL_LAYOUTS[0] ?? [];
  if (count <= 6) return MONTHLY_CELL_LAYOUTS[count] ?? [];
  return MONTHLY_CELL_LAYOUTS[6] ?? [];
}

const MAX_POSTS_PER_DAY = 6;
const MORE_SLOT_INDEX = 5;

export function MonthlyView({
  scheduledPosts,
  pastPosts = [],
  currentDate,
  onPostDrop,
  onPostEdit,
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
}: MonthlyViewProps) {
  const userTimezone = user?.timezone ?? "Etc/UTC";
  const { formatDate } = useFormattedDate();
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);

  const calendarDays = useMemo((): CalendarDay[] => {
    const currentZoned = fromDate(currentDate, "UTC");
    const year = currentZoned.year;
    const month = currentZoned.month;
    const firstDayZoned = createZonedDateTime(year, month, 1, 0, 0, "UTC");
    const dayOfWeek = firstDayZoned.dayOfWeek;
    const daysFromMonday = dayOfWeek === 7 ? 6 : dayOfWeek - 1;
    const startDateZoned = addDays(firstDayZoned, -daysFromMonday);
    const todayZoned = nowInTimezone("UTC");
    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const dateZoned = addDays(startDateZoned, i);
      const date = toDate(dateZoned);
      days.push({
        date,
        isCurrentMonth: dateZoned.month === month,
        isToday:
          dateZoned.year === todayZoned.year &&
          dateZoned.month === todayZoned.month &&
          dateZoned.day === todayZoned.day,
      });
    }
    return days;
  }, [currentDate]);

  const postsByDate = useMemo(
    (): PostsByDate =>
      postsToDateGrid(scheduledPosts, pastPosts, {
        userTimezone,
        isLongform,
        isAll,
      }),
    [scheduledPosts, pastPosts, userTimezone, isLongform, isAll]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, date: Date) => {
    const dateZoned = fromDate(date, userTimezone);
    const dateKey = `${dateZoned.year}-${String(dateZoned.month).padStart(2, "0")}-${String(dateZoned.day).padStart(2, "0")}`;
    if (isCalendarDropSlotInPast(dateKey, "09:00", userTimezone)) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const postData = JSON.parse(
      e.dataTransfer.getData("text/plain")
    ) as CalendarPost;
    const isoString = buildDropIsoString(dateKey, "09:00");
    const newDateTime = parseDropToDateTime(isoString, userTimezone);
    onPostDrop(postData, newDateTime);
  };

  const getCellContent = (
    dateKey: string,
    posts: CalendarPost[],
    dayInfo: CalendarDay
  ) => {
    const hasOverflow = posts.length > MAX_POSTS_PER_DAY;
    const postsToShow = hasOverflow
      ? posts.slice(0, MORE_SLOT_INDEX)
      : posts.slice(0, MAX_POSTS_PER_DAY);
    const remainingCount = hasOverflow
      ? Math.max(0, posts.length - MORE_SLOT_INDEX)
      : 0;
    const layoutCount = hasOverflow ? 7 : postsToShow.length;
    const layout = getMonthlyCellLayout(layoutCount);

    return (
      <>
        <div
          className={`font-medium ${
            isMobile ? "mb-0.5 text-xs" : "mb-1 text-sm"
          } ${
            dayInfo.isToday
              ? "text-foreground"
              : dayInfo.isCurrentMonth
                ? "text-foreground"
                : "text-muted-foreground"
          }`}
        >
          {dayInfo.date.getDate()}
        </div>
        <div
          className={`grid min-h-0 min-w-0 flex-1 grid-cols-2 grid-rows-3 overflow-hidden ${
            isMobile ? "gap-px" : "gap-0.5"
          }`}
        >
          {layout.map((placement, slotIndex) => {
            if (!placement) return null;
            const { row, col, colSpan } = placement;
            const isMoreLabel = hasOverflow && slotIndex === MORE_SLOT_INDEX;
            const post = !isMoreLabel ? postsToShow[slotIndex] : undefined;
            const gridRow = row + 1;
            return (
              <div
                key={
                  post?.id ??
                  (isMoreLabel
                    ? `more-${dateKey}`
                    : `slot-${row}-${col}-${colSpan}`)
                }
                className="min-h-0 min-w-0 overflow-hidden"
                style={{
                  gridRowStart: gridRow,
                  gridRowEnd: gridRow,
                  gridColumnStart: colSpan === 2 ? 1 : col + 1,
                  gridColumnEnd: colSpan === 2 ? -1 : col + 2,
                }}
              >
                {isMoreLabel ? (
                  <div
                    className={`text-muted-foreground/80 border-border/30 flex h-full min-h-0 items-center justify-center rounded-[var(--calendar-radius-sm)] border border-dashed ${
                      isMobile
                        ? "px-1 py-0.5 text-[10px]"
                        : "px-2 py-1 text-[11px]"
                    }`}
                  >
                    +{remainingCount > 9 ? "9" : remainingCount} more
                  </div>
                ) : post ? (
                  (() => {
                    const postIsLongform = isAll
                      ? Boolean(post.title && post.publishedAt)
                      : isLongform;
                    const postIsPast =
                      typeof post.isPast === "boolean" ? post.isPast : false;
                    const displayTime = getDisplayTime(
                      post,
                      postIsLongform,
                      postIsPast
                    );
                    const useHourOnly = isMobile && colSpan === 1;
                    const timeString = formatDate(displayTime, {
                      timezone: userTimezone,
                      dateFormatOptions: useHourOnly
                        ? { hour: "2-digit" }
                        : { hour: "2-digit", minute: "2-digit" },
                    });
                    const block = (
                      <PostBlock
                        key={post.id}
                        post={post}
                        compact={true}
                        minimal={true}
                        user={user}
                        queueTypes={queueTypes}
                        onEdit={onPostEdit}
                        isLongform={postIsLongform}
                        isPast={postIsPast}
                        timeLabel={timeString}
                        slotExpandRows={2}
                      />
                    );
                    return isMobile ? (
                      <div className="h-full min-h-0 text-[10px] [&_.text-xs]:!text-[10px]">
                        {block}
                      </div>
                    ) : (
                      block
                    );
                  })()
                ) : null}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const cellClassName = (dayInfo: CalendarDay) =>
    `border-border/40 flex min-h-[120px] flex-col border-r border-b last:border-r-0 ${
      isMobile ? "px-1 py-1" : "px-2 py-1.5"
    } ${
      dayInfo.isCurrentMonth
        ? "bg-[hsl(var(--calendar-surface-2-bg))]"
        : "bg-secondary/20"
    } ${dayInfo.isToday ? "ring-primary ring-1" : ""}`;

  return (
    <DateGrid
      calendarDays={calendarDays}
      postsByDate={postsByDate}
      getCellContent={getCellContent}
      onDrop={handleDrop}
      canDropDate={(date) => {
        const dateZoned = fromDate(date, userTimezone);
        const dateKey = `${dateZoned.year}-${String(dateZoned.month).padStart(2, "0")}-${String(dateZoned.day).padStart(2, "0")}`;
        return !isCalendarDropSlotInPast(dateKey, "09:00", userTimezone);
      }}
      weekdayLabels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
      userTimezone={userTimezone}
      cellClassName={cellClassName}
    />
  );
}
