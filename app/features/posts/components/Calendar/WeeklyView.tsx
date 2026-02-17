import { useState, useMemo, useRef, useEffect } from "react";

import { handleErrorSafely } from "~/lib/error-handler.client";
import {
  addDays,
  fromDate,
  fromISOString,
  nowInTimezone,
  parseDateTimeLocal,
  toDate,
} from "~/lib/temporal";

import type { QueueType, UserData } from "../../types";

import { PostBlock } from "./PostBlock";
import type { CalendarPost } from "./PostBlock.types";
import { getPostScheduleInstant } from "./PostBlock.utils";

interface WeeklyViewProps {
  scheduledPosts: CalendarPost[];
  pastPosts?: CalendarPost[];
  currentDate: Date;
  /** When provided (e.g. Day view), use these days instead of computing week from currentDate. */
  weekDaysOverride?: Date[];
  onPostDrop: (post: CalendarPost, newDateTime: Date) => void;
  onPostEdit: (post: CalendarPost) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
}

type PostsGrid = Record<string, Record<string, CalendarPost[]>>;

/** Default scroll: show 6:00 at top (Apple Calendar–style). Row height must match time row class (h-[52px]). */
const DEFAULT_SCROLL_HOUR = 6;
const ROW_HEIGHT_PX = 52;

/** Class for expanded post block wrapper so it sits on top with opaque background. */
const EXPANDED_BLOCK_WRAPPER_CLASS =
  "z-10 bg-[hsl(var(--calendar-surface-2-bg))]";

/** Number of empty slots below to fill (0–3). Only counts consecutive empty slots for the same date. Max 3 so block can span up to 4 rows when space allows; on hover it then doesn't need to grow. */
function getExpandDown(
  dateKey: string,
  timeSlot: string,
  postsGrid: PostsGrid,
  hours: string[]
): 0 | 1 | 2 | 3 {
  const idx = hours.indexOf(timeSlot);
  if (idx < 0 || idx >= hours.length - 1) return 0;
  const next1 = hours[idx + 1];
  if (next1 === undefined) return 0;
  const hasNext1 = (postsGrid[dateKey]?.[next1]?.length ?? 0) > 0;
  if (hasNext1) return 0;
  if (idx >= hours.length - 2) return 1;
  const next2 = hours[idx + 2];
  if (next2 === undefined) return 1;
  const hasNext2 = (postsGrid[dateKey]?.[next2]?.length ?? 0) > 0;
  if (hasNext2) return 1;
  if (idx >= hours.length - 3) return 2;
  const next3 = hours[idx + 3];
  if (next3 === undefined) return 2;
  const hasNext3 = (postsGrid[dateKey]?.[next3]?.length ?? 0) > 0;
  return hasNext3 ? 2 : 3;
}

interface CurrentTimeIndicatorProps {
  user?: UserData | null;
  weekDays: Date[];
}

export function WeeklyView({
  scheduledPosts,
  pastPosts = [],
  currentDate,
  weekDaysOverride,
  onPostDrop,
  onPostEdit,
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
}: WeeklyViewProps) {
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [hoveredPostKey, setHoveredPostKey] = useState<string | null>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const hasSetInitialScrollRef = useRef(false);

  // Generate week days starting from Monday, or use override (e.g. single day for Day view)
  const weekDays = useMemo(() => {
    if (weekDaysOverride && weekDaysOverride.length > 0) {
      return weekDaysOverride;
    }
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
  }, [currentDate, weekDaysOverride]);

  // Get user time format preference
  const userTimeFormat =
    user && typeof user === "object" && "timeFormat" in user
      ? user.timeFormat === "24h"
        ? "24h"
        : "12h"
      : "12h";

  // Generate hours - keys are always in 24-hour format for grid lookup
  const hours = useMemo(() => {
    const hoursList: string[] = [];
    for (let h = 0; h < 24; h++) {
      hoursList.push(`${h.toString().padStart(2, "0")}:00`);
      hoursList.push(`${h.toString().padStart(2, "0")}:30`);
    }
    return hoursList;
  }, []);

  // Generate display labels based on user's time format preference
  const hourLabels = useMemo(() => {
    const labels: string[] = [];
    if (userTimeFormat === "24h") {
      // 24-hour format: 00:00 to 23:30
      for (let h = 0; h < 24; h++) {
        labels.push(`${h.toString().padStart(2, "0")}:00`);
        labels.push(`${h.toString().padStart(2, "0")}:30`);
      }
    } else {
      // 12-hour format: 12:00 AM to 11:30 PM
      for (let h = 0; h < 24; h++) {
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const period = h < 12 ? "AM" : "PM";
        labels.push(`${hour12}:00 ${period}`);
        labels.push(`${hour12}:30 ${period}`);
      }
    }
    return labels;
  }, [userTimeFormat]);

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

    // Process scheduled posts (single source of truth: getPostScheduleInstant)
    scheduledPosts.forEach((post) => {
      const postIsLongform = Boolean(
        isAll ? !!post.title && post.publishedAt : isLongform
      );
      const ms = getPostScheduleInstant(post, postIsLongform, false);
      if (ms == null) return;
      const timeInUserTz = fromDate(new Date(ms), userTimezone);
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
    });

    // Process past posts
    pastPosts.forEach((post) => {
      const postIsLongform = Boolean(
        isAll ? !!post.title && post.publishedAt : isLongform
      );
      const ms = getPostScheduleInstant(post, postIsLongform, true);
      if (ms == null) return;
      const timeInUserTz = fromDate(new Date(ms), userTimezone);
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
    });

    return grid;
  }, [scheduledPosts, pastPosts, weekDays, user?.timezone, isLongform, isAll]);

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    date: string,
    time: string
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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

  // Default scroll to 6:00 once when the scroll container has layout (Apple Calendar–style)
  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el || hasSetInitialScrollRef.current) return;
    const slotIndex = DEFAULT_SCROLL_HOUR * 2; // 30-min slots: 6:00 is index 12
    const scrollTop = slotIndex * ROW_HEIGHT_PX;

    const apply = () => {
      if (hasSetInitialScrollRef.current || !gridScrollRef.current) return;
      gridScrollRef.current.scrollTop = scrollTop;
      hasSetInitialScrollRef.current = true;
    };

    // Wait for layout: ResizeObserver fires when the element gets a non-zero height
    const ro = new ResizeObserver(() => {
      if (el.clientHeight > 0 && !hasSetInitialScrollRef.current) {
        apply();
      }
    });
    ro.observe(el);
    // Fallback if already laid out (e.g. in tests)
    if (el.clientHeight > 0) {
      requestAnimationFrame(apply);
    }
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
      {/* Days header */}
      <div className="border-border/40 flex border-b bg-[hsl(var(--calendar-surface-2-bg))]">
        <div className="w-16 flex-shrink-0" />
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
              className={`border-border/30 flex min-w-0 flex-1 items-center justify-center gap-1 border-r px-2 py-1 text-center last:border-r-0 ${
                isToday ? "border-l-primary bg-primary/5 border-l-2" : ""
              }`}
            >
              <span className="text-muted-foreground text-xs font-normal">
                {day.toLocaleDateString("en-US", {
                  weekday: "short",
                  timeZone: user?.timezone ?? "Etc/UTC",
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

      {/* Time grid */}
      <div ref={gridScrollRef} className="h-0 min-h-0 flex-1 overflow-y-auto">
        <div className="relative">
          {hours.map((time, index) => {
            const dateKeysForRow = weekDays.map((day) => {
              const y = day.getFullYear();
              const m = String(day.getMonth() + 1).padStart(2, "0");
              const d = String(day.getDate()).padStart(2, "0");
              return `${y}-${m}-${d}`;
            });
            const rowHasExpanded = dateKeysForRow.some((dateKey) => {
              const posts = postsGrid[dateKey]?.[time] ?? [];
              return (
                posts.length === 1 &&
                getExpandDown(dateKey, time, postsGrid, hours) > 0
              );
            });
            const rowHasHovered = dateKeysForRow.some((dateKey) => {
              const posts = postsGrid[dateKey]?.[time] ?? [];
              return posts.some(
                (p) => hoveredPostKey === `${dateKey}-${time}-${p.id}`
              );
            });
            const rowZ = rowHasHovered ? "z-10" : rowHasExpanded ? "z-[1]" : "";

            return (
              <div
                key={time}
                className={`border-border/40 relative flex h-[52px] min-h-[52px] items-stretch overflow-visible border-b ${rowZ}`}
              >
                {/* Time label */}
                <div className="text-muted-foreground/85 w-16 flex-shrink-0 pr-2 text-right text-xs leading-none">
                  {hourLabels[index]}
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
                  const expandDown =
                    posts.length === 1
                      ? getExpandDown(dateKey, time, postsGrid, hours)
                      : 0;
                  const singlePostKey =
                    posts.length === 1 && posts[0]
                      ? `${dateKey}-${time}-${posts[0].id}`
                      : null;
                  const isHovered =
                    singlePostKey !== null && hoveredPostKey === singlePostKey;
                  const expandRows = Math.min(
                    1 + expandDown + (isHovered ? 2 : 0),
                    4
                  );
                  const blockHeightPx = expandRows * ROW_HEIGHT_PX - 4;

                  return (
                    <div
                      key={`${dateKey}-${time}`}
                      role="gridcell"
                      tabIndex={-1}
                      className={`border-border/30 relative min-w-0 flex-1 overflow-visible border-r px-1.5 py-1 transition-colors duration-200 last:border-r-0 ${
                        isDragOver
                          ? "bg-primary/5 border-primary/20"
                          : "dark:hover:bg-muted hover:bg-muted"
                      }`}
                      onDragOver={(e) => handleDragOver(e, dateKey, time)}
                      onDrop={(e) => handleDrop(e, dateKey, time)}
                      onDragLeave={handleDragLeave}
                    >
                      {posts.length === 1 ? (
                        // Single post - expand into empty slots below; on hover/focus expand over others
                        posts[0] ? (
                          // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover/focus wrapper for expansion; PostBlock inside is interactive
                          <div
                            className={`relative transition-[height] duration-200 ease-out ${
                              isHovered ? EXPANDED_BLOCK_WRAPPER_CLASS : "z-0"
                            }`}
                            style={{ height: blockHeightPx }}
                            onMouseEnter={() =>
                              singlePostKey && setHoveredPostKey(singlePostKey)
                            }
                            onMouseLeave={() => setHoveredPostKey(null)}
                            onFocusCapture={() =>
                              singlePostKey && setHoveredPostKey(singlePostKey)
                            }
                            onBlurCapture={() => setHoveredPostKey(null)}
                            onTouchStart={() =>
                              singlePostKey && setHoveredPostKey(singlePostKey)
                            }
                            onTouchEnd={() =>
                              setTimeout(() => setHoveredPostKey(null), 300)
                            }
                          >
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
                              forceOpaque={isHovered}
                            />
                          </div>
                        ) : null
                      ) : posts.length <= 6 ? (
                        // 2-6 posts - dynamic equal width distribution; each can expand on hover/focus
                        <div className="flex h-full space-x-0.5">
                          {posts.map((post, postIndex) => {
                            const multiPostKey = `${dateKey}-${time}-${post.id}`;
                            const multiHovered =
                              hoveredPostKey === multiPostKey;
                            const multiExpandRows = Math.min(
                              1 + (multiHovered ? 2 : 0),
                              4
                            );
                            const multiHeightPx =
                              multiExpandRows * ROW_HEIGHT_PX - 4;
                            return (
                              // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover/focus wrapper for expansion; PostBlock inside is interactive
                              <div
                                // eslint-disable-next-line react/no-array-index-key -- Composite key with stable post ID
                                key={`${post.id}-${postIndex}`}
                                className={`relative min-w-0 flex-1 transition-[height] duration-200 ease-out ${
                                  multiHovered
                                    ? EXPANDED_BLOCK_WRAPPER_CLASS
                                    : "z-0"
                                }`}
                                style={{ height: multiHeightPx }}
                                onMouseEnter={() =>
                                  setHoveredPostKey(multiPostKey)
                                }
                                onMouseLeave={() => setHoveredPostKey(null)}
                                onFocusCapture={() =>
                                  setHoveredPostKey(multiPostKey)
                                }
                                onBlurCapture={() => setHoveredPostKey(null)}
                                onTouchStart={() =>
                                  setHoveredPostKey(multiPostKey)
                                }
                                onTouchEnd={() =>
                                  setTimeout(() => setHoveredPostKey(null), 300)
                                }
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
                                  forceOpaque={multiHovered}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // More than 6 posts - show first 5 with overflow indicator; each can expand on hover/focus
                        <div className="flex h-full space-x-0.5">
                          {posts.slice(0, 5).map((post, postIndex) => {
                            const multiPostKey = `${dateKey}-${time}-${post.id}`;
                            const multiHovered =
                              hoveredPostKey === multiPostKey;
                            const multiExpandRows = Math.min(
                              1 + (multiHovered ? 2 : 0),
                              4
                            );
                            const multiHeightPx =
                              multiExpandRows * ROW_HEIGHT_PX - 4;
                            return (
                              // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover/focus wrapper for expansion; PostBlock inside is interactive
                              <div
                                // eslint-disable-next-line react/no-array-index-key -- Composite key with post.id ensures uniqueness
                                key={`${post.id}-${postIndex}`}
                                className={`relative min-w-0 flex-1 transition-[height] duration-200 ease-out ${
                                  multiHovered
                                    ? EXPANDED_BLOCK_WRAPPER_CLASS
                                    : "z-0"
                                }`}
                                style={{ height: multiHeightPx }}
                                onMouseEnter={() =>
                                  setHoveredPostKey(multiPostKey)
                                }
                                onMouseLeave={() => setHoveredPostKey(null)}
                                onFocusCapture={() =>
                                  setHoveredPostKey(multiPostKey)
                                }
                                onBlurCapture={() => setHoveredPostKey(null)}
                                onTouchStart={() =>
                                  setHoveredPostKey(multiPostKey)
                                }
                                onTouchEnd={() =>
                                  setTimeout(() => setHoveredPostKey(null), 300)
                                }
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
                                  forceOpaque={multiHovered}
                                />
                              </div>
                            );
                          })}
                          <div className="bg-muted text-muted-foreground flex flex-1 items-center justify-center rounded text-xs">
                            +{posts.length - 5}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

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
  // Each hour has 2 slots (30-minute intervals), each ROW_HEIGHT_PX tall
  const hourIndex = currentHour;
  const minuteProgress = currentMinutes / 60; // 0-1 progress through the hour

  // Calculate position:
  // - Each hour has 2 slots (00 and 30), so multiply by 2
  // - Add progress within the current hour
  const topOffset =
    hourIndex * 2 * ROW_HEIGHT_PX + minuteProgress * ROW_HEIGHT_PX * 2;

  return (
    <div
      className="bg-primary/90 pointer-events-none absolute right-0 left-16 z-20 h-0.5"
      style={{ top: `${topOffset}px` }}
    >
      <div className="bg-primary absolute -top-1 -left-2 h-2.5 w-2.5 rounded-full" />
    </div>
  );
}
