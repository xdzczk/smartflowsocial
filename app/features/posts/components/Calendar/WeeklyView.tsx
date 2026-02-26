import { useState, useMemo, useRef, useEffect } from "react";

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
  BOTTOM_ROWS_EXPAND_UP_THRESHOLD,
  DEFAULT_SCROLL_HOUR,
  HOURS_PER_DAY,
  MOBILE_WEEK_GRID_MIN_WIDTH,
  ROW_HEIGHT_PX,
  WEEK_VIEW_MIN_WIDTH,
} from "./components/weekly-view-constants";
import { parseDropToDateTime } from "./data/parse-drop-to-date-time";
import { postsToTimeGrid } from "./data/posts-to-time-grid";
import type { PostsGrid } from "./data/posts-to-time-grid";
import type { SlotState } from "./domain/grid-types";
import { getSlotState as getSlotStateDomain } from "./domain/slot-state";
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

function getSlotState(
  day: Date,
  time: string,
  postsGrid: PostsGrid,
  hours: string[],
  hoveredPostKey: string | null,
  dragOverSlot: string | null,
  userTimezone: string
): SlotState {
  const dayZoned = fromDate(day, userTimezone);
  const dateKey = `${dayZoned.year}-${String(dayZoned.month).padStart(2, "0")}-${String(dayZoned.day).padStart(2, "0")}`;
  return getSlotStateDomain(dateKey, time, postsGrid, hours, {
    hoveredPostKey,
    dragOverSlot,
    isDayView: false,
    userTimezone,
  });
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
  const { dateLocale } = useFormattedDate();
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [hoveredPostKey, setHoveredPostKey] = useState<string | null>(null);
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);
  const [gridScrollTop, setGridScrollTop] = useState(0);
  const [daysHeaderHeight, setDaysHeaderHeight] = useState(0);
  const [activeEmptySlotKey, setActiveEmptySlotKey] = useState<string | null>(
    null
  );
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const hasSetInitialScrollRef = useRef(false);

  const getDaysHeaderHeight = (container: HTMLDivElement): number => {
    const header = container.querySelector<HTMLElement>(
      '[data-calendar-days-header="true"]'
    );
    return header?.offsetHeight ?? 0;
  };

  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);

  const weekDays = useMemo(() => {
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
  }, [currentDate]);

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

  // Default scroll to 6:00 once when the scroll container has layout (Apple Calendar–style)
  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el || hasSetInitialScrollRef.current) return;
    const slotIndex = DEFAULT_SCROLL_HOUR * 2;
    const scrollTop = getDaysHeaderHeight(el) + slotIndex * ROW_HEIGHT_PX;

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

  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;
    const updateHeaderHeight = () => {
      setDaysHeaderHeight(getDaysHeaderHeight(el));
    };
    updateHeaderHeight();
    const ro = new ResizeObserver(updateHeaderHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Daily and Weekly: when a bottom-row block is hovered and expands upward, scroll so it isn’t cut off
  const userTz = user?.timezone ?? "Etc/UTC";
  useEffect(() => {
    if (!hoveredPostKey || !gridScrollRef.current) return;
    // Parse key: "dateKey-time-postId" (dateKey is YYYY-MM-DD)
    if (hoveredPostKey.length < 12) return;
    const dateKey = hoveredPostKey.slice(0, 10);
    const rest = hoveredPostKey.slice(11);
    const dashIdx = rest.indexOf("-");
    if (dashIdx < 0) return;
    const time = rest.slice(0, dashIdx);
    const day = weekDays.find((d) => {
      const z = fromDate(d, userTz);
      const dk = `${z.year}-${String(z.month).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`;
      return dk === dateKey;
    });
    if (!day) return;
    const slotState = getSlotState(
      day,
      time,
      postsGrid,
      hours,
      hoveredPostKey,
      dragOverSlot,
      userTz
    );
    const rowIndex = hours.indexOf(time);
    if (rowIndex < BOTTOM_ROWS_EXPAND_UP_THRESHOLD || rowIndex < 0) return;
    const expandRows = slotState.expandRows;
    const blockTopPx = Math.max(0, (rowIndex - expandRows + 1) * ROW_HEIGHT_PX);
    const el = gridScrollRef.current;
    const headerHeight = getDaysHeaderHeight(el);
    // Small margin so expanded block isn’t flush with top
    const scrollTarget = Math.max(0, headerHeight + blockTopPx - ROW_HEIGHT_PX);
    if (el.scrollTop > scrollTarget) {
      el.scrollTop = scrollTarget;
    }
  }, [hoveredPostKey, weekDays, hours, postsGrid, dragOverSlot, userTz]);

  return (
    <div className="relative flex h-0 min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {isMobile ? (
        <div className="pointer-events-none absolute top-0 left-0 z-[290] w-16">
          <div
            className="border-border/40 border-r bg-[hsl(var(--calendar-surface-2-bg))]"
            style={{ height: daysHeaderHeight }}
          />
          <div
            className="border-border/30 bg-[hsl(var(--calendar-surface-2-bg))]"
            style={{
              transform: `translateY(${daysHeaderHeight - gridScrollTop}px)`,
            }}
          >
            {hourLabels.map((label, index) => (
              <div
                key={hours[index] ?? `mobile-time-rail-${label}-${index}`}
                className="text-muted-foreground/85 border-border/30 flex w-16 items-start justify-end border-r pr-2 text-right text-xs leading-none"
                style={{ height: ROW_HEIGHT_PX - 1 }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Scroll container clears hover state when pointer exits grid area */}
      <div
        ref={gridScrollRef}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-auto"
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y",
          overscrollBehaviorX: "contain",
        }}
        onScroll={(e) => {
          setGridScrollTop(e.currentTarget.scrollTop);
        }}
        onMouseLeave={() => setHoveredPostKey(null)}
      >
        <div
          className={`flex min-h-[40vh] min-w-0 flex-none flex-col select-none ${isMobile ? "shrink-0 self-start" : ""}`}
          style={{
            ...(isMobile
              ? {
                  width: MOBILE_WEEK_GRID_MIN_WIDTH,
                  minWidth: MOBILE_WEEK_GRID_MIN_WIDTH,
                }
              : {
                  minWidth: WEEK_VIEW_MIN_WIDTH,
                }),
          }}
        >
          <DaysHeader
            weekDays={weekDays}
            user={user}
            dateLocale={dateLocale}
            isMobile={isMobile}
          />

          <TimeGrid
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
                user?.timezone ?? "Etc/UTC"
              )
            }
            hoveredPostKey={hoveredPostKey}
            setHoveredPostKey={setHoveredPostKey}
            dragOverSlot={dragOverSlot}
            userTimezone={user?.timezone ?? "Etc/UTC"}
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
            isMobile={isMobile}
          />
        </div>
      </div>
    </div>
  );
}
