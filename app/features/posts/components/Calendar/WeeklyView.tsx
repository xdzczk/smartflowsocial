import { useState, useMemo } from "react";

import { handleErrorSafely } from "~/lib/error-handler.client";

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
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
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
      const year = day.getFullYear();
      const month = String(day.getMonth() + 1).padStart(2, "0");
      const dayStr = String(day.getDate()).padStart(2, "0");
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
        const postDate = postIsLongform
          ? new Date(timestamp as string)
          : new Date(Number(timestamp) * 1000);
        // Convert to user's timezone for display
        const timeInUserTz = new Date(
          postDate.toLocaleString("en-US", { timeZone: userTimezone })
        );
        const year = timeInUserTz.getFullYear();
        const month = String(timeInUserTz.getMonth() + 1).padStart(2, "0");
        const dayStr = String(timeInUserTz.getDate()).padStart(2, "0");
        const dateKey = `${year}-${month}-${dayStr}`;
        const hour = timeInUserTz.getHours();
        const minutes = timeInUserTz.getMinutes();
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
        const postDate = new Date(timestamp as string);
        // Convert to user's timezone for display
        const timeInUserTz = new Date(
          postDate.toLocaleString("en-US", { timeZone: userTimezone })
        );
        const year = timeInUserTz.getFullYear();
        const month = String(timeInUserTz.getMonth() + 1).padStart(2, "0");
        const dayStr = String(timeInUserTz.getDate()).padStart(2, "0");
        const dateKey = `${year}-${month}-${dayStr}`;
        const hour = timeInUserTz.getHours();
        const minutes = timeInUserTz.getMinutes();
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

    // Use a library approach - create the date as if it's in user's timezone
    // This is the reverse of how we display dates - we convert from user timezone to UTC
    try {
      // Create a temporary date in browser's local timezone
      const tempDate = new Date(isoString);

      // Convert to user's timezone and back to get the right UTC offset
      const userTzDate = new Date(
        tempDate.toLocaleString("sv-SE", { timeZone: userTimezone })
      );
      const localTzDate = new Date(tempDate.toLocaleString("sv-SE"));

      // Calculate the difference and apply it
      const diff = localTzDate.getTime() - userTzDate.getTime();
      const newDateTime = new Date(tempDate.getTime() + diff);

      onPostDrop(postData, newDateTime);
    } catch (error) {
      handleErrorSafely(
        error,
        {
          component: "WeeklyView",
          action: "handleDrop",
        },
        () => {
          // Fallback to simple date creation
          const newDateTime = new Date(isoString);
          onPostDrop(postData, newDateTime);
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
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <div className="w-16 flex-shrink-0"></div>
        {weekDays.map((day) => {
          const isToday = day.toDateString() === new Date().toDateString();
          return (
            <div
              key={day.toISOString()}
              className={`min-w-0 flex-1 border-r border-gray-200 p-3 text-center last:border-r-0 dark:border-gray-700 ${
                isToday ? "bg-blue-50 dark:bg-blue-900/20" : ""
              }`}
            >
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {day.toLocaleDateString("en-US", {
                  weekday: "short",
                  timeZone: user?.timezone ?? "Etc/UTC",
                })}
              </div>
              <div
                className={`mt-1 text-lg font-semibold ${
                  isToday
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-900 dark:text-white"
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
            <div
              key={time}
              className="flex h-12 border-b border-gray-100 dark:border-gray-800"
            >
              {/* Time label */}
              <div className="w-16 flex-shrink-0 p-2 text-right text-xs text-gray-500 dark:text-gray-400">
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
                    className={`relative min-w-0 flex-1 overflow-visible border-r border-gray-100 p-1 last:border-r-0 dark:border-gray-800 ${
                      isDragOver
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                    onDragOver={(e) => handleDragOver(e, dateKey, time)}
                    onDrop={(e) => handleDrop(e, dateKey, time)}
                    onDragLeave={handleDragLeave}
                  >
                    {posts.length === 1 ? (
                      // Single post - full width
                      posts[0] ? (
                        <PostBlock
                          post={posts[0]}
                          compact={true}
                          user={user}
                          queueTypes={queueTypes}
                          onEdit={onPostEdit}
                          isLongform={
                            isAll
                              ? Boolean(posts[0].title && posts[0].publishedAt)
                              : isLongform
                          }
                          isPast={
                            typeof posts[0].isPast === "boolean"
                              ? posts[0].isPast
                              : false
                          }
                        />
                      ) : null
                    ) : posts.length <= 6 ? (
                      // 2-6 posts - dynamic equal width distribution with smaller labels
                      <div className="flex h-full space-x-0.5">
                        {posts.map((post, postIndex) => (
                          <div
                            key={`${post.id}-${postIndex}`}
                            className="min-w-0 flex-1"
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
                            key={`${post.id}-${postIndex}`}
                            className="min-w-0 flex-1"
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
                        <div className="flex flex-1 items-center justify-center rounded bg-gray-100 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
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
  const now = new Date();
  const nowInUserTz = new Date(
    now.toLocaleString("en-US", { timeZone: userTimezone })
  );
  const currentHour = nowInUserTz.getHours();
  const currentMinutes = nowInUserTz.getMinutes();

  // Check if today is in the current week view
  const today = new Date();
  const todayString = today.toDateString();
  const isTodayInWeek = weekDays.some(
    (day) => day.toDateString() === todayString
  );

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
      className="pointer-events-none absolute right-0 left-16 z-20 h-0.5 bg-red-500"
      style={{ top: `${topOffset}px` }}
    >
      <div className="absolute -top-1 -left-2 h-3 w-3 rounded-full bg-red-500"></div>
    </div>
  );
}
