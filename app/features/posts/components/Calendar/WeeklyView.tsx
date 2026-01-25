import { useState, useMemo } from "react";

import { handleErrorSafely } from "~/lib/error-handler.client";
import {
  addDays,
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

interface WeeklyViewProps {
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

type PostsGrid = Record<string, Record<string, CalendarPost[]>>;

interface CurrentTimeIndicatorProps {
  user?: UserData | null;
  weekDays: Date[];
}

export function WeeklyView({
  scheduledPosts,
  pastPosts = [],
  currentDate,
  onPostDrop,
  onPostEdit,
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
}: WeeklyViewProps) {
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  // Generate week days starting from Monday
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    const currentZoned = fromDate(currentDate, "UTC");
    // dayOfWeek: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
    const dayOfWeek = currentZoned.dayOfWeek;
    const daysFromMonday = dayOfWeek === 7 ? 6 : dayOfWeek - 1; // Convert Sunday (7) to 6 days back
    const startOfWeekZoned = addDays(currentZoned, -daysFromMonday);

    for (let i = 0; i < 7; i++) {
      const dayZoned = addDays(startOfWeekZoned, i);
      days.push(toDate(dayZoned));
    }
    return days;
  }, [currentDate]);

  // Generate hours (00:00 to 23:30)
  const hours = useMemo(() => {
    const hoursList: string[] = [];
    for (let h = 0; h < 24; h++) {
      hoursList.push(`${h.toString().padStart(2, "0")}:00`);
      hoursList.push(`${h.toString().padStart(2, "0")}:30`);
    }
    return hoursList;
  }, []);

  // Group posts by date and time
  const postsGrid = useMemo(() => {
    const grid: PostsGrid = {};
    const userTimezone = user?.timezone ?? "Etc/UTC";

    // Initialize grid with user timezone date keys
    weekDays.forEach((day) => {
      const dayZoned = fromDate(day, userTimezone);
      const year = dayZoned.year;
      const month = String(dayZoned.month).padStart(2, "0");
      const dayStr = String(dayZoned.day).padStart(2, "0");
      const dateKey = `${year}-${month}-${dayStr}`;
      grid[dateKey] = {};
    });

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
        const dayStr = String(timeInUserTz.day).padStart(2, "0");
        const dateKey = `${year}-${month}-${dayStr}`;
        const hour = timeInUserTz.hour;
        const minutes = timeInUserTz.minute;
        const timeSlot = `${hour.toString().padStart(2, "0")}:${minutes >= 30 ? "30" : "00"}`;

        if (grid[dateKey]) {
          grid[dateKey][timeSlot] ??= [];
          grid[dateKey][timeSlot].push({ ...post, isPast: false });
        }
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
        const dayStr = String(timeInUserTz.day).padStart(2, "0");
        const dateKey = `${year}-${month}-${dayStr}`;
        const hour = timeInUserTz.hour;
        const minutes = timeInUserTz.minute;
        const timeSlot = `${hour.toString().padStart(2, "0")}:${minutes >= 30 ? "30" : "00"}`;

        if (grid[dateKey]) {
          grid[dateKey][timeSlot] ??= [];
          grid[dateKey][timeSlot].push({ ...post, isPast: true });
        }
      }
    });

    return grid;
  }, [scheduledPosts, pastPosts, weekDays, user?.timezone, isLongform, isAll]);

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    date: string,
    time: string
  ) => {
    e.preventDefault();
    setDragOverSlot(`${date}-${time}`);
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    date: string,
    time: string
  ) => {
    e.preventDefault();
    setDragOverSlot(null);

    const postData = JSON.parse(
      e.dataTransfer.getData("text/plain")
    ) as CalendarPost;
    const [hours, minutes] = time.split(":").map(Number);
    const safeHours = hours ?? 0;
    const safeMinutes = minutes ?? 0;

    // Create the datetime that represents the intended time in the user's timezone
    const userTimezone = user?.timezone ?? "Etc/UTC";

    // Create an ISO string that represents the local time in the user's timezone
    const isoString = `${date}T${safeHours.toString().padStart(2, "0")}:${safeMinutes.toString().padStart(2, "0")}:00`;

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
          component: "WeeklyView",
          action: "handleDrop",
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

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden">
      {/* Days header */}
      <div className="border-border bg-card flex border-b">
        <div className="w-16 flex-shrink-0"></div>
        {weekDays.map((day) => {
          const userTimezone = user?.timezone ?? "Etc/UTC";
          const todayZoned = nowInTimezone(userTimezone);
          const dayZoned = fromDate(day, userTimezone);
          const isToday =
            dayZoned.year === todayZoned.year &&
            dayZoned.month === todayZoned.month &&
            dayZoned.day === todayZoned.day;
          return (
            <div
              key={day.toISOString()}
              className={`border-border min-w-0 flex-1 border-r p-3 text-center last:border-r-0 ${
                isToday ? "bg-muted" : ""
              }`}
            >
              <div className="text-foreground text-sm font-medium">
                {day.toLocaleDateString("en-US", {
                  weekday: "short",
                  timeZone: user?.timezone ?? "Etc/UTC",
                })}
              </div>
              <div
                className={`mt-1 text-lg font-semibold ${
                  isToday ? "text-primary" : "text-foreground"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          {hours.map((time) => (
            <div key={time} className="border-border flex h-12 border-b">
              {/* Time label */}
              <div className="text-muted-foreground w-16 flex-shrink-0 p-2 text-right text-xs">
                {time}
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                // Use local date to match the posts grouping
                const year = day.getFullYear();
                const month = String(day.getMonth() + 1).padStart(2, "0");
                const dayStr = String(day.getDate()).padStart(2, "0");
                const dateKey = `${year}-${month}-${dayStr}`;
                const posts = postsGrid[dateKey]?.[time] ?? [];
                const slotKey = `${dateKey}-${time}`;
                const isDragOver = dragOverSlot === slotKey;

                return (
                  <div
                    key={`${dateKey}-${time}`}
                    role="gridcell"
                    tabIndex={-1}
                    className={`border-border relative min-w-0 flex-1 overflow-hidden border-r p-1 last:border-r-0 ${
                      isDragOver
                        ? "bg-primary/5 border-primary/20"
                        : "dark:hover:bg-muted hover:bg-muted"
                    }`}
                    onDragOver={(e) => handleDragOver(e, dateKey, time)}
                    onDrop={(e) => handleDrop(e, dateKey, time)}
                    onDragLeave={handleDragLeave}
                  >
                    {posts.length === 1 ? (
                      // Single post - full width with height constraint
                      posts[0] ? (
                        <div className="h-full">
                          <PostBlock
                            post={posts[0]}
                            compact={true}
                            user={user}
                            queueTypes={queueTypes}
                            onEdit={onPostEdit}
                            isLongform={
                              isAll
                                ? Boolean(
                                    posts[0].title && posts[0].publishedAt
                                  )
                                : isLongform
                            }
                            isPast={
                              typeof posts[0].isPast === "boolean"
                                ? posts[0].isPast
                                : false
                            }
                          />
                        </div>
                      ) : null
                    ) : posts.length <= 6 ? (
                      // 2-6 posts - dynamic equal width distribution with height constraint
                      <div className="flex h-full space-x-0.5">
                        {posts.map((post, postIndex) => (
                          <div
                            // eslint-disable-next-line react/no-array-index-key -- Composite key with stable post ID
                            key={`${post.id}-${postIndex}`}
                            className="h-full min-w-0 flex-1 overflow-hidden"
                          >
                            <PostBlock
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
                                typeof post.isPast === "boolean"
                                  ? post.isPast
                                  : false
                              }
                              multipleInCell={true}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      // More than 6 posts - show first 5 with overflow indicator
                      <div className="flex h-full space-x-0.5">
                        {posts.slice(0, 5).map((post, postIndex) => (
                          <div
                            // eslint-disable-next-line react/no-array-index-key -- Composite key with post.id ensures uniqueness
                            key={`${post.id}-${postIndex}`}
                            className="h-full min-w-0 flex-1 overflow-hidden"
                          >
                            <PostBlock
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
                                typeof post.isPast === "boolean"
                                  ? post.isPast
                                  : false
                              }
                              multipleInCell={true}
                            />
                          </div>
                        ))}
                        <div className="bg-muted text-muted-foreground flex flex-1 items-center justify-center rounded text-xs">
                          +{posts.length - 5}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Current time indicator - only show if today is in this week */}
          <CurrentTimeIndicator user={user} weekDays={weekDays} />
        </div>
      </div>
    </div>
  );
}

function CurrentTimeIndicator({ user, weekDays }: CurrentTimeIndicatorProps) {
  const userTimezone = user?.timezone ?? "Etc/UTC";
  const nowZoned = nowInTimezone(userTimezone);
  const currentHour = nowZoned.hour;
  const currentMinutes = nowZoned.minute;

  // Check if today is in the current week view
  const todayZoned = nowZoned;
  const isTodayInWeek = weekDays.some((day) => {
    const dayZoned = fromDate(day, userTimezone);
    return (
      dayZoned.year === todayZoned.year &&
      dayZoned.month === todayZoned.month &&
      dayZoned.day === todayZoned.day
    );
  });

  if (!isTodayInWeek) return null;

  // Find the exact position for current time
  // Each hour has 2 slots (30-minute intervals), each 48px tall (h-12 = 48px)
  const hourIndex = currentHour;
  const minuteProgress = currentMinutes / 60; // 0-1 progress through the hour

  // Calculate position:
  // - Each hour has 2 slots (00 and 30), so multiply by 2
  // - Add progress within the current hour
  const topOffset = hourIndex * 2 * 48 + minuteProgress * 48 * 2;

  return (
    <div
      className="bg-destructive pointer-events-none absolute right-0 left-16 z-20 h-0.5"
      style={{ top: `${topOffset}px` }}
    >
      <div className="bg-destructive absolute -top-1 -left-2 h-3 w-3 rounded-full"></div>
    </div>
  );
}
