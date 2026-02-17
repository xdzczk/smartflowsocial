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

/** Row z-index range (below Dialog z-50) so modals and overlays stay on top of the calendar grid. */
const CALENDAR_ROW_Z_HOVERED = 40;
const CALENDAR_ROW_Z_BASE = 39;

/** Class for expanded post block wrapper so it sits on top with opaque background. */
const EXPANDED_BLOCK_WRAPPER_CLASS =
  "z-10 bg-[hsl(var(--calendar-surface-2-bg))]";

/** Single-post blocks only: max half the row width; multi-post blocks use full width. */
const SINGLE_POST_MAX_WIDTH_CLASS = "max-w-[50%]";

/** Max empty slots to count below (week view: 3 → up to 4 rows; day view: 6 → up to 7 rows). */
const WEEK_VIEW_MAX_EXPAND = 3;
const DAY_VIEW_MAX_EXPAND = 6;

/** Number of empty slots below to fill. Counts consecutive empty slots for the same date. */
function getExpandDown(
  dateKey: string,
  timeSlot: string,
  postsGrid: PostsGrid,
  hours: string[],
  maxEmptySlots: number = WEEK_VIEW_MAX_EXPAND
): number {
  const idx = hours.indexOf(timeSlot);
  if (idx < 0 || idx >= hours.length - 1) return 0;
  let count = 0;
  for (let i = 1; i <= maxEmptySlots && idx + i < hours.length; i++) {
    const nextSlot = hours[idx + i];
    if (nextSlot === undefined) break;
    if ((postsGrid[dateKey]?.[nextSlot]?.length ?? 0) > 0) break;
    count = i;
  }
  return count;
}

interface SlotState {
  dateKey: string;
  posts: CalendarPost[];
  slotKey: string;
  isDragOver: boolean;
  singlePostKey: string | null;
  isHovered: boolean;
  expandRows: number;
  blockHeightPx: number;
}

function getSlotState(
  day: Date,
  time: string,
  postsGrid: PostsGrid,
  hours: string[],
  hoveredPostKey: string | null,
  dragOverSlot: string | null,
  isDayView: boolean,
  userTimezone: string
): SlotState {
  const dayZoned = fromDate(day, userTimezone);
  const dateKey = `${dayZoned.year}-${String(dayZoned.month).padStart(2, "0")}-${String(dayZoned.day).padStart(2, "0")}`;
  const posts = postsGrid[dateKey]?.[time] ?? [];
  const slotKey = `${dateKey}-${time}`;
  const isDragOver = dragOverSlot === slotKey;
  const maxExpand = isDayView ? DAY_VIEW_MAX_EXPAND : WEEK_VIEW_MAX_EXPAND;
  const expandDown =
    posts.length === 1
      ? getExpandDown(dateKey, time, postsGrid, hours, maxExpand)
      : 0;
  const singlePostKey =
    posts.length === 1 && posts[0] ? `${dateKey}-${time}-${posts[0].id}` : null;
  const isHovered = singlePostKey !== null && hoveredPostKey === singlePostKey;
  const baseRows = 1 + expandDown; // Day view: up to 7 rows by default when empty space below (expandDown 0–6)
  const expandRows = isDayView
    ? isHovered
      ? baseRows <= 4
        ? 5
        : baseRows
      : baseRows
    : isHovered
      ? baseRows >= 3
        ? baseRows
        : Math.min(baseRows + 2, 3)
      : baseRows;
  const blockHeightPx = expandRows * ROW_HEIGHT_PX - 4;
  return {
    dateKey,
    posts,
    slotKey,
    isDragOver,
    singlePostKey,
    isHovered,
    expandRows,
    blockHeightPx,
  };
}

interface SlotCellContentProps {
  slotState: SlotState;
  time: string;
  isDayView: boolean;
  /** In day view: 0 = left column, 1 = right column for alternating single-post blocks */
  slotColumn?: 0 | 1;
  hoveredPostKey: string | null;
  setHoveredPostKey: (key: string | null) => void;
  onPostEdit: (post: CalendarPost) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform: boolean;
  isAll: boolean;
}

function SlotCellContent({
  slotState,
  time,
  isDayView,
  slotColumn,
  hoveredPostKey,
  setHoveredPostKey,
  onPostEdit,
  user,
  queueTypes,
  isLongform,
  isAll,
}: SlotCellContentProps) {
  const { dateKey, posts, singlePostKey, isHovered, blockHeightPx } = slotState;

  if (posts.length === 1) {
    if (!posts[0]) return null;
    const blockInner = (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover/focus wrapper for expansion; PostBlock inside is interactive
      <div
        className={`relative w-full min-w-0 transition-[height] duration-200 ease-out ${
          isHovered ? EXPANDED_BLOCK_WRAPPER_CLASS : "z-0"
        }`}
        style={{ height: blockHeightPx }}
        onMouseEnter={() => singlePostKey && setHoveredPostKey(singlePostKey)}
        onMouseLeave={() => setHoveredPostKey(null)}
        onFocusCapture={() => singlePostKey && setHoveredPostKey(singlePostKey)}
        onBlurCapture={() => setHoveredPostKey(null)}
        onTouchStart={() => singlePostKey && setHoveredPostKey(singlePostKey)}
        onTouchEnd={() => setTimeout(() => setHoveredPostKey(null), 300)}
      >
        <PostBlock
          post={posts[0]}
          compact={true}
          user={user}
          queueTypes={queueTypes}
          onEdit={onPostEdit}
          isLongform={
            isAll ? Boolean(posts[0].title && posts[0].publishedAt) : isLongform
          }
          isPast={
            typeof posts[0].isPast === "boolean" ? posts[0].isPast : false
          }
          forceOpaque={isHovered}
        />
      </div>
    );
    if (isDayView && slotColumn === 1) {
      return (
        <div className="flex w-full justify-end">
          <div className="w-[50%] min-w-0 shrink-0">{blockInner}</div>
        </div>
      );
    }
    if (isDayView) {
      return <div className={SINGLE_POST_MAX_WIDTH_CLASS}>{blockInner}</div>;
    }
    return blockInner;
  }

  if (posts.length <= 6) {
    return (
      <div className="relative flex h-full space-x-0.5">
        {posts.map((post, index) => (
          <MultiPostBlock
            key={post.id}
            post={post}
            dateKey={dateKey}
            time={time}
            isDayView={isDayView}
            postsCount={posts.length}
            alignExpandedRight={index >= posts.length / 2}
            hoveredPostKey={hoveredPostKey}
            setHoveredPostKey={setHoveredPostKey}
            onPostEdit={onPostEdit}
            user={user}
            queueTypes={queueTypes}
            isLongform={isLongform}
            isAll={isAll}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex h-full space-x-0.5">
      {posts.slice(0, 5).map((post, index) => (
        <MultiPostBlock
          key={post.id}
          post={post}
          dateKey={dateKey}
          time={time}
          isDayView={isDayView}
          postsCount={posts.length}
          alignExpandedRight={index >= 3}
          hoveredPostKey={hoveredPostKey}
          setHoveredPostKey={setHoveredPostKey}
          onPostEdit={onPostEdit}
          user={user}
          queueTypes={queueTypes}
          isLongform={isLongform}
          isAll={isAll}
        />
      ))}
      <div className="bg-muted text-muted-foreground flex flex-1 items-center justify-center rounded text-xs">
        +{posts.length - 5}
      </div>
    </div>
  );
}

/** In Daily view, max expanded rows per multi-post block by number of blocks in the row: 3→5, 4→4, 5+→3. */
function getDayViewMultiMaxRows(postsCount: number): number {
  if (postsCount <= 2) return 3;
  if (postsCount === 3) return 5;
  if (postsCount === 4) return 4;
  return 3;
}

interface MultiPostBlockProps {
  post: CalendarPost;
  dateKey: string;
  time: string;
  isDayView: boolean;
  /** Total number of post blocks in this row (for Daily view expansion rules). */
  postsCount: number;
  alignExpandedRight?: boolean;
  hoveredPostKey: string | null;
  setHoveredPostKey: (key: string | null) => void;
  onPostEdit: (post: CalendarPost) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform: boolean;
  isAll: boolean;
}

function MultiPostBlock({
  post,
  dateKey,
  time,
  isDayView,
  postsCount,
  alignExpandedRight: _alignExpandedRight = false,
  hoveredPostKey,
  setHoveredPostKey,
  onPostEdit,
  user,
  queueTypes,
  isLongform,
  isAll,
}: MultiPostBlockProps) {
  const multiPostKey = `${dateKey}-${time}-${post.id}`;
  const multiHovered = hoveredPostKey === multiPostKey;
  const multiExpandRows = isDayView
    ? multiHovered
      ? getDayViewMultiMaxRows(postsCount)
      : 1
    : Math.min(1 + (multiHovered ? 2 : 0), 3);
  const multiHeightPx = multiExpandRows * ROW_HEIGHT_PX - 4;
  const expandedClass = multiHovered
    ? isDayView
      ? `${EXPANDED_BLOCK_WRAPPER_CLASS} relative min-w-0 flex-1`
      : `${EXPANDED_BLOCK_WRAPPER_CLASS} absolute inset-0 w-full`
    : "relative z-0 min-w-0 flex-1";
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Hover/focus wrapper for expansion; PostBlock inside is interactive
    <div
      className={`transition-[height] duration-200 ease-out ${expandedClass}`}
      style={{ height: multiHeightPx }}
      onMouseEnter={() => setHoveredPostKey(multiPostKey)}
      onMouseLeave={() => setHoveredPostKey(null)}
      onFocusCapture={() => setHoveredPostKey(multiPostKey)}
      onBlurCapture={() => setHoveredPostKey(null)}
      onTouchStart={() => setHoveredPostKey(multiPostKey)}
      onTouchEnd={() => setTimeout(() => setHoveredPostKey(null), 300)}
    >
      <PostBlock
        post={post}
        compact={true}
        minimal={true}
        user={user}
        queueTypes={queueTypes}
        onEdit={onPostEdit}
        isLongform={
          isAll ? Boolean(post.title && post.publishedAt) : isLongform
        }
        isPast={typeof post.isPast === "boolean" ? post.isPast : false}
        multipleInCell={true}
        forceOpaque={multiHovered}
      />
    </div>
  );
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

  const isDayView = Boolean(weekDaysOverride?.length === 1);

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

  // In day view: assign single-post slots to column 0 (left) or 1 (right) so overlapping blocks alternate
  const dayViewColumnMap = useMemo((): Record<string, 0 | 1> => {
    const firstDay = weekDays[0];
    const empty: Record<string, 0 | 1> = {};
    if (!isDayView || !firstDay) return empty;
    const userTimezone = user?.timezone ?? "Etc/UTC";
    const dayZoned = fromDate(firstDay, userTimezone);
    const dateKey = `${dayZoned.year}-${String(dayZoned.month).padStart(2, "0")}-${String(dayZoned.day).padStart(2, "0")}`;
    const map: Record<string, 0 | 1> = {};
    let column0End = 0;
    let column1End = 0;
    for (let timeIdx = 0; timeIdx < hours.length; timeIdx++) {
      const time = hours[timeIdx];
      if (time === undefined) continue;
      const posts = postsGrid[dateKey]?.[time] ?? [];
      if (posts.length !== 1) continue;
      const expandDown = getExpandDown(
        dateKey,
        time,
        postsGrid,
        hours,
        DAY_VIEW_MAX_EXPAND
      );
      const baseRows = 1 + expandDown;
      const slotKey = `${dateKey}-${time}`;
      const start = timeIdx;
      const end = timeIdx + baseRows;
      if (start >= column0End) {
        map[slotKey] = 0;
        column0End = end;
      } else if (start >= column1End) {
        map[slotKey] = 1;
        column1End = end;
      } else {
        const useCol = column0End <= column1End ? 0 : 1;
        map[slotKey] = useCol;
        if (useCol === 0) column0End = end;
        else column1End = end;
      }
    }
    return map;
  }, [isDayView, weekDays, hours, postsGrid, user?.timezone]);

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
            const rowHasHovered = dateKeysForRow.some((dateKey) => {
              const posts = postsGrid[dateKey]?.[time] ?? [];
              return posts.some(
                (p) => hoveredPostKey === `${dateKey}-${time}-${p.id}`
              );
            });
            // Row order = stacking order: earlier rows on top so expanded blocks cover cells below (values < 50 so modals stay on top)
            const rowZIndex = rowHasHovered
              ? CALENDAR_ROW_Z_HOVERED
              : Math.max(1, CALENDAR_ROW_Z_BASE - index);

            return (
              <div
                key={time}
                className="border-border/40 relative flex h-[52px] min-h-[52px] items-stretch overflow-visible border-b"
                style={{ zIndex: rowZIndex }}
              >
                {/* Time label */}
                <div className="text-muted-foreground/85 w-16 flex-shrink-0 pr-2 text-right text-xs leading-none">
                  {hourLabels[index]}
                </div>

                {/* Day columns */}
                {weekDays.map((day) => {
                  const slotState = getSlotState(
                    day,
                    time,
                    postsGrid,
                    hours,
                    hoveredPostKey,
                    dragOverSlot,
                    isDayView,
                    user?.timezone ?? "Etc/UTC"
                  );
                  return (
                    <div
                      key={slotState.slotKey}
                      role="gridcell"
                      tabIndex={-1}
                      className={`border-border/30 relative min-w-0 flex-1 overflow-visible border-r px-1.5 py-1 transition-colors duration-200 last:border-r-0 ${
                        slotState.isDragOver
                          ? "bg-primary/5 border-primary/20"
                          : "dark:hover:bg-muted hover:bg-muted"
                      }`}
                      onDragOver={(e) =>
                        handleDragOver(e, slotState.dateKey, time)
                      }
                      onDrop={(e) => handleDrop(e, slotState.dateKey, time)}
                      onDragLeave={handleDragLeave}
                    >
                      <SlotCellContent
                        slotState={slotState}
                        time={time}
                        isDayView={isDayView}
                        slotColumn={
                          isDayView
                            ? (dayViewColumnMap[slotState.slotKey] ?? 0)
                            : undefined
                        }
                        hoveredPostKey={hoveredPostKey}
                        setHoveredPostKey={setHoveredPostKey}
                        onPostEdit={onPostEdit}
                        user={user}
                        queueTypes={queueTypes}
                        isLongform={isLongform}
                        isAll={isAll}
                      />
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
      className="bg-primary/90 pointer-events-none absolute right-0 left-16 z-[41] h-0.5"
      style={{ top: `${topOffset}px` }}
    >
      <div className="bg-primary absolute -top-1 -left-2 h-2.5 w-2.5 rounded-full" />
    </div>
  );
}
