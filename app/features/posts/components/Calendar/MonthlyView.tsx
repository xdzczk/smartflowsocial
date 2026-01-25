import { useMemo } from "react";

import { handleErrorSafely } from "~/lib/error-handler.client";
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
      // Use postedAt for past posts
      const timestamp = post.postedAt;
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

  return (
    <div className="flex h-full flex-col">
      {/* Weekday headers */}
      <div className="grid flex-shrink-0 grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {weekdays.map((day) => (
          <div
            key={day}
            className="p-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-0 overflow-auto">
        {calendarDays.map((dayInfo) => {
          // Use local date to match the posts grouping
          const year = dayInfo.date.getFullYear();
          const month = String(dayInfo.date.getMonth() + 1).padStart(2, "0");
          const day = String(dayInfo.date.getDate()).padStart(2, "0");
          const dateKey = `${year}-${month}-${day}`;
          const posts = postsByDate[dateKey] ?? [];
          const postsToShow = posts.slice(0, 3); // Show max 3 posts
          const remainingCount = Math.max(0, posts.length - 3);

          return (
            <div
              key={dayInfo.date.toISOString()}
              role="gridcell"
              tabIndex={-1}
              className={`flex min-h-[120px] flex-col border-r border-b border-gray-200 p-2 last:border-r-0 dark:border-gray-700 ${
                dayInfo.isCurrentMonth
                  ? "bg-white dark:bg-gray-800"
                  : "bg-secondary/20"
              } ${dayInfo.isToday ? "ring-2 ring-blue-500" : ""}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, dayInfo.date)}
            >
              {/* Date number */}
              <div
                className={`mb-1 text-sm font-medium ${
                  dayInfo.isToday
                    ? "text-primary"
                    : dayInfo.isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {dayInfo.date.getDate()}
              </div>

              {/* Posts */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {postsToShow.map((post, postIndex) => (
                  <PostBlock
                    // eslint-disable-next-line react/no-array-index-key -- Composite key with stable post ID
                    key={`${post.id}-${postIndex}`}
                    post={post}
                    compact={true}
                    minimal={true}
                    user={user}
                    queueTypes={queueTypes}
                    onEdit={onPostEdit}
                    isLongform={
                      isAll
                        ? Boolean(post.title && post.publishedAt)
                        : isLongform
                    }
                    isPast={
                      typeof post.isPast === "boolean" ? post.isPast : false
                    }
                  />
                ))}

                {/* Show remaining count */}
                {remainingCount > 0 && Boolean(remainingCount) ? (
                  <div className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                    +{remainingCount} more
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
