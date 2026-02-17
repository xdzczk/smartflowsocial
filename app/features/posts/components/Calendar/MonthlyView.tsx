import { useMemo } from "react";

import { handleErrorSafely } from "~/lib/error-handler.client";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  addDays,
  createZonedDateTime,
  fromDate,
  fromISOString,
  fromUnixTimestamp,
  nowInTimezone,
  parseDateTimeLocal,
  toDate,
} from "~/lib/temporal";

import type { QueueType, UserData } from "../../types";

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

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

type PostsByDate = Record<string, CalendarPost[]>;

/** Slot placement in the 2×3 grid: row (0–2), col (0–1), colSpan (1 or 2). */
interface SlotPlacement {
  row: number;
  col: number;
  colSpan: number;
}

/** Layout config per post count (0–6). Count 7+ uses same grid as 6 with slot 5 = "+N more". */
const MONTHLY_CELL_LAYOUTS: Array<Array<SlotPlacement | null>> = [
  [], // 0 posts: no slots
  [{ row: 0, col: 0, colSpan: 2 }], // 1: one full row
  [
    { row: 0, col: 0, colSpan: 2 },
    { row: 1, col: 0, colSpan: 2 },
  ], // 2: two full rows
  [
    { row: 0, col: 0, colSpan: 2 },
    { row: 1, col: 0, colSpan: 2 },
    { row: 2, col: 0, colSpan: 2 },
  ], // 3: three full rows
  [
    { row: 0, col: 0, colSpan: 1 },
    { row: 0, col: 1, colSpan: 1 },
    { row: 1, col: 0, colSpan: 1 },
    { row: 1, col: 1, colSpan: 1 },
  ], // 4: 2×2
  [
    { row: 0, col: 0, colSpan: 1 },
    { row: 0, col: 1, colSpan: 1 },
    { row: 1, col: 0, colSpan: 1 },
    { row: 1, col: 1, colSpan: 1 },
    { row: 2, col: 0, colSpan: 2 },
  ], // 5: 2×2 + one full row
  [
    { row: 0, col: 0, colSpan: 1 },
    { row: 0, col: 1, colSpan: 1 },
    { row: 1, col: 0, colSpan: 1 },
    { row: 1, col: 1, colSpan: 1 },
    { row: 2, col: 0, colSpan: 1 },
    { row: 2, col: 1, colSpan: 1 },
  ], // 6: 2+2+2
];

function getMonthlyCellLayout(count: number): Array<SlotPlacement | null> {
  if (count <= 0) return MONTHLY_CELL_LAYOUTS[0] ?? [];
  if (count <= 6) return MONTHLY_CELL_LAYOUTS[count] ?? [];
  return MONTHLY_CELL_LAYOUTS[6] ?? []; // 7+: same as 6, slot 5 will show "+N more"
}

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
  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const currentZoned = fromDate(currentDate, "UTC");
    const year = currentZoned.year;
    const month = currentZoned.month;

    // First day of the month
    const firstDayZoned = createZonedDateTime(year, month, 1, 0, 0, "UTC");

    // Start from the Monday of the week containing the first day
    const dayOfWeek = firstDayZoned.dayOfWeek; // 1 = Monday, 7 = Sunday
    const daysFromMonday = dayOfWeek === 7 ? 6 : dayOfWeek - 1;
    const startDateZoned = addDays(firstDayZoned, -daysFromMonday);

    // Generate 6 weeks (42 days)
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

  // Group posts by date
  const postsByDate = useMemo(() => {
    const grouped: PostsByDate = {};
    const userTimezone = user?.timezone ?? "Etc/UTC";

    // Process scheduled posts
    scheduledPosts.forEach((post) => {
      // Determine if this specific post is longform when in All tab
      const postIsLongform = isAll
        ? !!post.title && post.publishedAt
        : isLongform;
      // For longform posts, use publishedAt, for regular posts use scheduledFor
      const timestamp = postIsLongform ? post.publishedAt : post.scheduledFor;
      if (timestamp) {
        // Parse timestamp and convert to user's timezone
        const postZoned = postIsLongform
          ? fromISOString(timestamp as string, "UTC")
          : fromUnixTimestamp(Number(timestamp), "UTC");
        const timeInUserTz = postZoned.withTimeZone(userTimezone);
        const year = timeInUserTz.year;
        const month = String(timeInUserTz.month).padStart(2, "0");
        const day = String(timeInUserTz.day).padStart(2, "0");
        const dateKey = `${year}-${month}-${day}`;

        grouped[dateKey] ??= [];
        grouped[dateKey].push({ ...post, isPast: false });
      }
    });

    // Process past posts
    pastPosts.forEach((post) => {
      // Use publishedAt for past posts
      const timestamp = post.publishedAt;
      if (timestamp) {
        // Parse timestamp and convert to user's timezone
        const postZoned = fromISOString(timestamp as string, "UTC");
        const timeInUserTz = postZoned.withTimeZone(userTimezone);
        const year = timeInUserTz.year;
        const month = String(timeInUserTz.month).padStart(2, "0");
        const day = String(timeInUserTz.day).padStart(2, "0");
        const dateKey = `${year}-${month}-${day}`;

        grouped[dateKey] ??= [];
        grouped[dateKey].push({ ...post, isPast: true });
      }
    });

    return grouped;
  }, [scheduledPosts, pastPosts, user?.timezone, isLongform, isAll]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, date: Date) => {
    e.preventDefault();

    const postData = JSON.parse(
      e.dataTransfer.getData("text/plain")
    ) as CalendarPost;
    const userTimezone = user?.timezone ?? "Etc/UTC";

    // For monthly view, we'll set time to 9:00 AM by default in user's timezone
    const dateZoned = fromDate(date, userTimezone);
    const year = dateZoned.year;
    const month = String(dateZoned.month).padStart(2, "0");
    const day = String(dateZoned.day).padStart(2, "0");
    const isoString = `${year}-${month}-${day}T09:00`;

    try {
      // Parse datetime-local string (YYYY-MM-DDTHH:mm) in user's timezone
      // Then convert to UTC Date for storage
      const zonedDateTime = parseDateTimeLocal(isoString, userTimezone);
      const utcZoned = zonedDateTime.withTimeZone("UTC");
      const newDateTime = toDate(utcZoned);

      onPostDrop(postData, newDateTime);
    } catch (error) {
      handleErrorSafely(
        error,
        {
          component: "MonthlyView",
          action: "handlePostDrop",
        },
        () => {
          // Fallback: try to parse as UTC
          try {
            const zonedDateTime = parseDateTimeLocal(isoString, "UTC");
            const newDateTime = toDate(zonedDateTime);
            onPostDrop(postData, newDateTime);
          } catch {
            // Last resort: use Temporal for 100% consistency
            try {
              const zoned = fromISOString(isoString + "Z", "UTC");
              onPostDrop(postData, toDate(zoned));
            } catch {
              // Fallback - try with Date conversion
              try {
                const dateObj = new Date(isoString + "Z");
                const zoned = fromDate(dateObj, "UTC");
                onPostDrop(postData, toDate(zoned));
              } catch {
                // Ultimate fallback
                const dateObj = new Date(isoString + "Z");
                onPostDrop(postData, dateObj);
              }
            }
          }
        }
      );
    }
  };

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const { formatDate } = useFormattedDate();

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Weekday headers */}
      <div className="border-border/40 grid flex-shrink-0 grid-cols-7 border-b bg-[hsl(var(--calendar-surface-2-bg))]">
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-muted-foreground px-2 py-2 text-center text-sm font-medium"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid h-0 min-h-0 flex-1 auto-rows-[minmax(7.5rem,1fr)] grid-cols-7 gap-0 overflow-auto">
        {calendarDays.map((dayInfo) => {
          // Use local date to match the posts grouping
          const year = dayInfo.date.getFullYear();
          const month = String(dayInfo.date.getMonth() + 1).padStart(2, "0");
          const day = String(dayInfo.date.getDate()).padStart(2, "0");
          const dateKey = `${year}-${month}-${day}`;
          const posts = postsByDate[dateKey] ?? [];
          const hasOverflow = posts.length > 6;
          const postsToShow = hasOverflow
            ? posts.slice(0, 5)
            : posts.slice(0, 6);
          const remainingCount = hasOverflow
            ? Math.max(0, posts.length - 5)
            : 0;
          const layoutCount = hasOverflow ? 7 : postsToShow.length;
          const layout = getMonthlyCellLayout(layoutCount);

          return (
            <div
              key={dayInfo.date.toISOString()}
              role="gridcell"
              tabIndex={-1}
              className={`border-border/40 flex min-h-[120px] flex-col border-r border-b p-2.5 last:border-r-0 ${
                dayInfo.isCurrentMonth
                  ? "bg-[hsl(var(--calendar-surface-2-bg))]"
                  : "bg-secondary/20"
              } ${dayInfo.isToday ? "ring-primary ring-1" : ""}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, dayInfo.date)}
            >
              {/* Date number */}
              <div
                className={`mb-1 text-sm font-medium ${
                  dayInfo.isToday
                    ? "text-foreground"
                    : dayInfo.isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {dayInfo.date.getDate()}
              </div>

              {/* Posts: 2×3 grid, up to 6 posts or 5 + "+N more", no internal scroll */}
              <div className="grid min-h-[7rem] min-w-0 flex-1 grid-cols-2 grid-rows-3 gap-1 overflow-hidden">
                {layout.map((placement, slotIndex) => {
                  if (!placement) return null;
                  const { row, col, colSpan } = placement;
                  const isMoreLabel = hasOverflow && slotIndex === 5;
                  const post = !isMoreLabel
                    ? postsToShow[slotIndex]
                    : undefined;

                  const gridRow = row + 1;

                  return (
                    <div
                      key={
                        post?.id ??
                        (isMoreLabel
                          ? `more-${dateKey}`
                          : `slot-${row}-${col}-${colSpan}`)
                      }
                      className="min-w-0 overflow-hidden"
                      style={{
                        gridRowStart: gridRow,
                        gridRowEnd: gridRow,
                        gridColumnStart: colSpan === 2 ? 1 : col + 1,
                        gridColumnEnd: colSpan === 2 ? -1 : col + 2,
                      }}
                    >
                      {isMoreLabel ? (
                        <div className="text-muted-foreground/80 border-border/30 flex h-full items-center justify-center rounded-[var(--calendar-radius-sm)] border border-dashed px-2 py-1 text-[11px]">
                          +{remainingCount > 9 ? "9" : remainingCount} more
                        </div>
                      ) : post ? (
                        (() => {
                          const postIsLongform = isAll
                            ? Boolean(post.title && post.publishedAt)
                            : isLongform;
                          const postIsPast =
                            typeof post.isPast === "boolean"
                              ? post.isPast
                              : false;
                          const displayTime = getDisplayTime(
                            post,
                            postIsLongform,
                            postIsPast
                          );
                          const userTz = user?.timezone ?? "Etc/UTC";
                          const timeString = formatDate(displayTime, {
                            timezone: userTz,
                            dateFormatOptions: {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          });
                          return (
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
                            />
                          );
                        })()
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
