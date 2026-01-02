import { useMemo } from "react";

import { handleErrorSafely } from "~/lib/error-handler.client";

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
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);

    // Start from the Monday of the week containing the first day
    const startDate = new Date(firstDay);
    const startDayOfWeek = startDate.getDay();
    startDate.setDate(
      startDate.getDate() - (startDayOfWeek === 0 ? 6 : startDayOfWeek - 1),
    );

    // Generate 6 weeks (42 days)
    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push({
        date,
        isCurrentMonth: date.getMonth() === month,
        isToday: date.toDateString() === new Date().toDateString(),
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
        const postDate = postIsLongform
          ? new Date(timestamp as string)
          : new Date(Number(timestamp) * 1000);
        // Convert to user's timezone for display
        const timeInUserTz = new Date(
          postDate.toLocaleString("en-US", { timeZone: userTimezone }),
        );
        const year = timeInUserTz.getFullYear();
        const month = String(timeInUserTz.getMonth() + 1).padStart(2, "0");
        const day = String(timeInUserTz.getDate()).padStart(2, "0");
        const dateKey = `${year}-${month}-${day}`;

        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push({ ...post, isPast: false });
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
          postDate.toLocaleString("en-US", { timeZone: userTimezone }),
        );
        const year = timeInUserTz.getFullYear();
        const month = String(timeInUserTz.getMonth() + 1).padStart(2, "0");
        const day = String(timeInUserTz.getDate()).padStart(2, "0");
        const dateKey = `${year}-${month}-${day}`;

        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
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
      e.dataTransfer.getData("text/plain"),
    ) as CalendarPost;
    const userTimezone = user?.timezone ?? "Etc/UTC";

    // For monthly view, we'll set time to 9:00 AM by default in user's timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const isoString = `${year}-${month}-${day}T09:00:00`;

    try {
      // Create a temporary date in browser's local timezone
      const tempDate = new Date(isoString);

      // Convert to user's timezone and back to get the right UTC offset
      const userTzDate = new Date(
        tempDate.toLocaleString("sv-SE", { timeZone: userTimezone }),
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
          component: "MonthlyView",
          action: "handlePostDrop",
        },
        () => {
          // Fallback to simple date creation
          const newDateTime = new Date(date);
          newDateTime.setHours(9, 0, 0, 0);
          onPostDrop(postData, newDateTime);
        },
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
        {calendarDays.map((dayInfo, index) => {
          // Use local date to match the posts grouping
          const year = dayInfo.date.getFullYear();
          const month = String(dayInfo.date.getMonth() + 1).padStart(2, "0");
          const day = String(dayInfo.date.getDate()).padStart(2, "0");
          const dateKey = `${year}-${month}-${day}`;
          const posts = postsByDate[dateKey] || [];
          const postsToShow = posts.slice(0, 3); // Show max 3 posts
          const remainingCount = Math.max(0, posts.length - 3);

          return (
            <div
              key={index}
              role="gridcell"
              tabIndex={-1}
              className={`flex min-h-[120px] flex-col border-b border-r border-gray-200 p-2 last:border-r-0 dark:border-gray-700 ${
                dayInfo.isCurrentMonth
                  ? "bg-white dark:bg-gray-800"
                  : "bg-gray-50 dark:bg-gray-900"
              } ${dayInfo.isToday ? "ring-2 ring-blue-500" : ""}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, dayInfo.date)}
            >
              {/* Date number */}
              <div
                className={`mb-1 text-sm font-medium ${
                  dayInfo.isToday
                    ? "text-blue-600 dark:text-blue-400"
                    : dayInfo.isCurrentMonth
                      ? "text-gray-900 dark:text-white"
                      : "text-gray-400 dark:text-gray-600"
                }`}
              >
                {dayInfo.date.getDate()}
              </div>

              {/* Posts */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {postsToShow.map((post, postIndex) => (
                  <PostBlock
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
