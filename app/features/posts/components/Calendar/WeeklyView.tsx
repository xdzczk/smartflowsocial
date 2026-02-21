import { useState, useMemo, useRef, useEffect, useCallback } from "react";

import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import { addDays, fromDate, toDate } from "~/lib/temporal";

import type { QueueType, UserData } from "../../types";
import { CONTENT_MOBILE_BREAKPOINT_PX } from "../constants";

import {
  buildDropIsoString,
  formatDropSlotAriaLabel,
} from "./calendar-helpers";
import { DaysHeader } from "./components/DaysHeader";
import { TimeGrid } from "./components/TimeGrid";
import {
  DEFAULT_SCROLL_HOUR,
  HOURS_PER_DAY,
  MOBILE_WEEK_GRID_MIN_WIDTH,
  ROW_HEIGHT_PX,
  WEEK_VIEW_MIN_WIDTH,
} from "./components/weekly-view-constants";
import { parseDropToDateTime } from "./data/parse-drop-to-date-time";
import { postsToTimeGrid } from "./data/posts-to-time-grid";
import type { PostsGrid } from "./data/posts-to-time-grid";
import { getDayViewColumnMap } from "./domain/day-view-column-map";
import type { SlotState } from "./domain/grid-types";
import { getSlotState as getSlotStateDomain } from "./domain/slot-state";
import type { CalendarPost } from "./PostBlock.types";

interface WeeklyViewProps {
  scheduledPosts: CalendarPost[];
  pastPosts?: CalendarPost[];
  currentDate: Date;
  /** When provided (e.g. Day view), use these days instead of computing week from currentDate. */
  weekDaysOverride?: Date[];
  onPostDrop: (post: CalendarPost, newDateTime: Date) => void;
  onPostEdit: (post: CalendarPost) => void;
  /** Day view: post currently selected in the sidebar; its block stays highlighted. */
  selectedPost?: CalendarPost | null;
  /** Day view: called when user clicks empty space to clear selection. */
  onClearSelection?: () => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
}

function getSlotState(
  day: Date,
  time: string,
  postsGrid: PostsGrid,
  hours: string[],
  hoveredPostKey: string | null,
  dragOverSlot: string | null,
  isDayView: boolean,
  userTimezone: string,
  dayViewColumnMap?: Record<string, 0 | 1>,
  selectedPost?: CalendarPost | null,
  hoveredPostKeyByColumn?: Record<0 | 1, string | null>
): SlotState {
  const dayZoned = fromDate(day, userTimezone);
  const dateKey = `${dayZoned.year}-${String(dayZoned.month).padStart(2, "0")}-${String(dayZoned.day).padStart(2, "0")}`;
  return getSlotStateDomain(dateKey, time, postsGrid, hours, {
    hoveredPostKey: isDayView ? null : hoveredPostKey,
    hoveredPostKeyByColumn: isDayView ? hoveredPostKeyByColumn : undefined,
    dragOverSlot,
    isDayView,
    userTimezone,
    dayViewColumnMap,
    selectedPost,
  });
}

export function WeeklyView({
  scheduledPosts,
  pastPosts = [],
  currentDate,
  weekDaysOverride,
  onPostDrop,
  onPostEdit,
  selectedPost,
  onClearSelection,
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
}: WeeklyViewProps) {
  const { dateLocale } = useFormattedDate();
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [hoveredPostKey, setHoveredPostKey] = useState<string | null>(null);
  const [hoveredPostKeyByColumn, setHoveredPostKeyByColumn] = useState<
    Record<0 | 1, string | null>
  >(() => ({ 0: null, 1: null }));
  const setHoveredPostKeyForColumn = useCallback(
    (column: 0 | 1, key: string | null) => {
      setHoveredPostKeyByColumn((prev) =>
        prev[column] === key ? prev : { ...prev, [column]: key }
      );
    },
    []
  );
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);
  const [activeEmptySlotKey, setActiveEmptySlotKey] = useState<string | null>(
    null
  );
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const hasSetInitialScrollRef = useRef(false);

  const isDayView = Boolean(weekDaysOverride?.length === 1);
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);

  // Generate week days starting from Monday, or use override (e.g. single day for Day view)
  const weekDays = useMemo(() => {
    if (weekDaysOverride && weekDaysOverride.length > 0) {
      return weekDaysOverride;
    }
    const days: Date[] = [];
    const currentZoned = fromDate(currentDate, "UTC");
    const dayOfWeek = currentZoned.dayOfWeek;
    const daysFromMonday = dayOfWeek === 7 ? 6 : dayOfWeek - 1;
    const startOfWeekZoned = addDays(currentZoned, -daysFromMonday);

    for (let i = 0; i < 7; i++) {
      const dayZoned = addDays(startOfWeekZoned, i);
      days.push(toDate(dayZoned));
    }
    return days;
  }, [currentDate, weekDaysOverride]);

  const userTimeFormat =
    user && typeof user === "object" && "timeFormat" in user
      ? user.timeFormat === "24h"
        ? "24h"
        : "12h"
      : "12h";

  const hours = useMemo(() => {
    const hoursList: string[] = [];
    for (let h = 0; h < HOURS_PER_DAY; h++) {
      hoursList.push(`${h.toString().padStart(2, "0")}:00`);
      hoursList.push(`${h.toString().padStart(2, "0")}:30`);
    }
    return hoursList;
  }, []);

  const hourLabels = useMemo(() => {
    const labels: string[] = [];
    if (userTimeFormat === "24h") {
      for (let h = 0; h < HOURS_PER_DAY; h++) {
        labels.push(`${h.toString().padStart(2, "0")}:00`);
        labels.push(`${h.toString().padStart(2, "0")}:30`);
      }
    } else {
      for (let h = 0; h < HOURS_PER_DAY; h++) {
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const period = h < 12 ? "AM" : "PM";
        labels.push(`${hour12}:00 ${period}`);
        labels.push(`${hour12}:30 ${period}`);
      }
    }
    return labels;
  }, [userTimeFormat]);

  const userTimezone = user?.timezone ?? "Etc/UTC";
  const weekDaysDateKeys = useMemo(() => {
    return weekDays.map((day) => {
      const dayZoned = fromDate(day, userTimezone);
      return `${dayZoned.year}-${String(dayZoned.month).padStart(2, "0")}-${String(dayZoned.day).padStart(2, "0")}`;
    });
  }, [weekDays, userTimezone]);

  const postsGrid = useMemo(
    () =>
      postsToTimeGrid(scheduledPosts, pastPosts, weekDaysDateKeys, hours, {
        userTimezone,
        isLongform,
        isAll,
      }),
    [
      scheduledPosts,
      pastPosts,
      weekDaysDateKeys,
      hours,
      userTimezone,
      isLongform,
      isAll,
    ]
  );

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
    const isoString = buildDropIsoString(date, time);
    const newDateTime = parseDropToDateTime(isoString, userTimezone);
    onPostDrop(postData, newDateTime);
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const dayViewColumnMap = useMemo((): Record<string, 0 | 1> => {
    const firstKey = weekDaysDateKeys[0];
    if (!isDayView || firstKey === undefined) return {};
    return getDayViewColumnMap(postsGrid, firstKey, hours);
  }, [isDayView, weekDaysDateKeys, postsGrid, hours]);

  // Default scroll to 6:00 once when the scroll container has layout (Apple Calendar–style)
  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el || hasSetInitialScrollRef.current) return;
    const slotIndex = DEFAULT_SCROLL_HOUR * 2;
    const scrollTop = slotIndex * ROW_HEIGHT_PX;

    const apply = () => {
      if (hasSetInitialScrollRef.current || !gridScrollRef.current) return;
      gridScrollRef.current.scrollTop = scrollTop;
      hasSetInitialScrollRef.current = true;
    };

    const ro = new ResizeObserver(() => {
      if (el.clientHeight > 0 && !hasSetInitialScrollRef.current) {
        apply();
      }
    });
    ro.observe(el);
    if (el.clientHeight > 0) {
      requestAnimationFrame(apply);
    }
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="flex min-h-0 flex-1 flex-col overflow-x-auto"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          className="flex min-h-0 min-h-[40vh] flex-1 flex-col overflow-hidden select-none"
          style={{
            ...(isMobile && !isDayView
              ? {
                  width: MOBILE_WEEK_GRID_MIN_WIDTH,
                  minWidth: MOBILE_WEEK_GRID_MIN_WIDTH,
                }
              : {
                  minWidth: isMobile ? undefined : WEEK_VIEW_MIN_WIDTH,
                }),
          }}
        >
          <DaysHeader
            weekDays={weekDays}
            user={user}
            dateLocale={dateLocale}
            isMobile={isMobile}
            isDayView={isDayView}
          />

          <TimeGrid
            gridScrollRef={gridScrollRef}
            hours={hours}
            hourLabels={hourLabels}
            weekDays={weekDays}
            getSlotState={(day, time) =>
              getSlotState(
                day,
                time,
                postsGrid,
                hours,
                hoveredPostKey,
                dragOverSlot,
                isDayView,
                user?.timezone ?? "Etc/UTC",
                isDayView ? dayViewColumnMap : undefined,
                isDayView ? selectedPost : undefined,
                isDayView ? hoveredPostKeyByColumn : undefined
              )
            }
            hoveredPostKey={hoveredPostKey}
            setHoveredPostKey={setHoveredPostKey}
            hoveredPostKeyByColumn={
              isDayView ? hoveredPostKeyByColumn : undefined
            }
            setHoveredPostKeyForColumn={
              isDayView ? setHoveredPostKeyForColumn : undefined
            }
            dragOverSlot={dragOverSlot}
            isDayView={isDayView}
            userTimezone={user?.timezone ?? "Etc/UTC"}
            dayViewColumnMap={dayViewColumnMap}
            selectedPost={isDayView ? selectedPost : undefined}
            hoveredSlotKey={hoveredSlotKey}
            setHoveredSlotKey={setHoveredSlotKey}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={handleDragLeave}
            formatDropSlotAriaLabel={(dateKey, time, userTz, locale) =>
              formatDropSlotAriaLabel(
                dateKey,
                time,
                userTz,
                (locale ?? dateLocale) as "en-GB" | "en-US" | "sv"
              )
            }
            dateLocale={dateLocale}
            onPostEdit={onPostEdit}
            user={user}
            queueTypes={queueTypes}
            isLongform={isLongform}
            isAll={isAll}
            activeEmptySlotKey={activeEmptySlotKey}
            setActiveEmptySlotKey={setActiveEmptySlotKey}
            onClearSelection={onClearSelection}
            isMobile={isMobile}
          />
        </div>
      </div>
    </div>
  );
}
