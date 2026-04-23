import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useSyncExternalStore,
} from "react";

import { CONTENT_MOBILE_BREAKPOINT_PX } from "~/features/posts/components/constants";
import type { QueueType, UserData } from "~/features/posts/types";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import { addDays, fromDate, nowInTimezone, toDate } from "~/lib/temporal";

import {
  buildDropIsoString,
  formatDropSlotAriaLabel,
  isCalendarDropSlotInPast,
} from "./calendar-helpers";
import { DaysHeader } from "./components/DaysHeader";
import { TimeGrid } from "./components/TimeGrid";
import {
  BOTTOM_ROWS_EXPAND_UP_THRESHOLD,
  CURRENT_TIME_INDICATOR_Z,
  DEFAULT_SCROLL_HOUR,
  HOURS_PER_DAY,
  MOBILE_WEEK_GRID_MIN_WIDTH,
  ROW_HEIGHT_PX,
  WEEK_VIEW_MIN_WIDTH,
} from "./components/weekly-view-constants";
import { parseDropToDateTime } from "./data/parse-drop-to-date-time";
import { postsToTimeGrid } from "./data/posts-to-time-grid";
import type { PostsGrid } from "./data/posts-to-time-grid";
import type { SlotState, HoverOverlayPayload } from "./domain/grid-types";
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

const WEEK_SCROLL_DEBUG_STORAGE_KEY = "debugWeekScroll";

function subscribeNoop(): () => void {
  return () => {};
}

function subscribeMinute(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const id = window.setInterval(() => {
    onStoreChange();
  }, 30_000);
  return () => window.clearInterval(id);
}

function getWeekScrollDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "development") return true;
  if (
    new URLSearchParams(window.location.search).has(
      WEEK_SCROLL_DEBUG_STORAGE_KEY
    )
  ) {
    return true;
  }
  try {
    return window.localStorage.getItem(WEEK_SCROLL_DEBUG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Client-only opt-in flag that toggles the WeeklyView diagnostic overlay.
 * Returns `false` during SSR and the first client render so the overlay
 * never appears in server HTML (preventing hydration mismatches).
 */
function useWeekScrollDebugEnabled(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    getWeekScrollDebugEnabled,
    () => false
  );
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
  const [hoverOverlayPayload, setHoverOverlayPayload] =
    useState<HoverOverlayPayload | null>(null);
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);
  const [activeEmptySlotKey, setActiveEmptySlotKey] = useState<string | null>(
    null
  );
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const hasSetInitialScrollRef = useRef(false);
  const debugEnabled = useWeekScrollDebugEnabled();
  const [scrollDebugMetrics, setScrollDebugMetrics] = useState<{
    scrollWidth: number;
    clientWidth: number;
    scrollLeft: number;
    viewportInnerWidth: number;
  } | null>(null);

  // Track vertical scroll position so the current-time dot (rendered in the
  // non-scrolling outer wrapper) stays aligned with the correct time row.
  const [scrollTop, setScrollTop] = useState(0);
  // Height of the sticky DaysHeader, used to compute the dot's clamped top.
  const [daysHeaderHeight, setDaysHeaderHeight] = useState(0);

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

  // Current-time dot: subscribe to clock so it moves every 30 s. Returns
  // null during SSR (preventing hydration mismatch). The DOT is rendered in
  // the outer (non-scrolling) wrapper at left:4rem so it stays glued to the
  // time column's right edge regardless of horizontal scroll position.
  // Must be declared after userTimezone and weekDays are in scope.
  const indicatorNowKey = useSyncExternalStore(
    subscribeMinute,
    () => {
      const z = nowInTimezone(userTimezone);
      return `${z.year}|${z.month}|${z.day}|${z.hour}|${z.minute}`;
    },
    () => null
  );
  const indicatorTopOffset = useMemo<number | null>(() => {
    if (!indicatorNowKey) return null;
    const parts = indicatorNowKey.split("|").map(Number);
    if (parts.length < 5) return null;
    const [y, mo, d, h, mi] = parts as [number, number, number, number, number];
    const isTodayInWeek = weekDays.some((day) => {
      const dz = fromDate(day, userTimezone);
      return dz.year === y && dz.month === mo && dz.day === d;
    });
    if (!isTodayInWeek) return null;
    return h * 2 * ROW_HEIGHT_PX + (mi / 60) * ROW_HEIGHT_PX * 2;
  }, [indicatorNowKey, weekDays, userTimezone]);

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
    if (isCalendarDropSlotInPast(date, time, userTimezone)) {
      setDragOverSlot(null);
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(`${date}-${time}`);
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    date: string,
    time: string
  ) => {
    if (isCalendarDropSlotInPast(date, time, userTimezone)) {
      e.preventDefault();
      setDragOverSlot(null);
      return;
    }
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

  // Diagnostic overlay: measure the scroll container so we can verify on-
  // device whether the Week view is actually horizontally overflowing.
  //
  // If `scrollWidth > clientWidth` but the user can't pan, the layout is
  // fine and the problem is a touch-gesture or ancestor issue; if they're
  // equal, the layout itself is broken and no amount of touch-action
  // tweaking helps.
  //
  // Enabled in local dev automatically, or anywhere (including staging) by
  // appending `?debugWeekScroll=1` to the URL, OR by setting
  // `localStorage.setItem("debugWeekScroll","1")`. Kept off by default in
  // production so users never see it.
  useEffect(() => {
    if (!debugEnabled) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).has("debugWeekScroll")) {
      window.localStorage.setItem("debugWeekScroll", "1");
    }
    const el = gridScrollRef.current;
    const measure = () => {
      const inner = window.innerWidth;
      if (!el) {
        setScrollDebugMetrics({
          scrollWidth: 0,
          clientWidth: 0,
          scrollLeft: 0,
          viewportInnerWidth: inner,
        });
        return;
      }
      setScrollDebugMetrics({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollLeft: el.scrollLeft,
        viewportInnerWidth: inner,
      });
    };
    // First measure scheduled in the next microtask so we don't call
    // setState synchronously in the effect body (lint rule).
    const raf = window.requestAnimationFrame(measure);
    const ro = el ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el);
    if (el) el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(raf);
      ro?.disconnect();
      if (el) el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [debugEnabled]);

  // Measure the DaysHeader height after mount so the outer-wrapper dot is
  // positioned correctly. Re-measures on scroll-container resize (e.g. font
  // size change, dynamic header appearance).
  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;
    const measure = () => setDaysHeaderHeight(getDaysHeaderHeight(el));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const commonTimeGridProps = {
    hours,
    hourLabels,
    weekDays,
    getSlotState: (day: Date, time: string) =>
      getSlotState(
        day,
        time,
        postsGrid,
        hours,
        null,
        dragOverSlot,
        user?.timezone ?? "Etc/UTC"
      ),
    hoveredPostKey,
    setHoveredPostKey,
    dragOverSlot,
    userTimezone: user?.timezone ?? "Etc/UTC",
    hoveredSlotKey,
    setHoveredSlotKey,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    onDragLeave: handleDragLeave,
    formatDropSlotAriaLabel: (
      dateKey: string,
      time: string,
      userTz: string,
      locale?: string
    ) =>
      formatDropSlotAriaLabel(
        dateKey,
        time,
        userTz,
        (locale ?? dateLocale) as "en-GB" | "en-US" | "en-CA"
      ),
    dateLocale,
    onPostEdit,
    user,
    queueTypes,
    isLongform,
    isAll,
    activeEmptySlotKey,
    setActiveEmptySlotKey,
    hoverOverlayPayload,
    setHoverOverlayPayload,
  };

  const gridMinWidth = isMobile
    ? MOBILE_WEEK_GRID_MIN_WIDTH
    : WEEK_VIEW_MIN_WIDTH;

  const overflowsHorizontally = scrollDebugMetrics
    ? scrollDebugMetrics.scrollWidth > scrollDebugMetrics.clientWidth
    : false;

  // Both the line and dot are rendered in the outer (non-scrolling) wrapper so
  // neither is displaced by horizontal panning. Top is computed from the
  // current-time row offset minus how far the user has scrolled.
  // Hide entirely when the row has scrolled above the header so a phantom
  // stripe doesn't appear pinned at the top of the content area.
  // overflow-hidden on the outer wrapper clips naturally when below the fold.
  const rawIndicatorTop =
    indicatorTopOffset !== null
      ? daysHeaderHeight + indicatorTopOffset - scrollTop
      : null;
  // rawIndicatorTop < daysHeaderHeight  ⟺  indicatorTopOffset < scrollTop
  const showIndicator =
    rawIndicatorTop !== null && rawIndicatorTop >= daysHeaderHeight;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Current-time line + dot both live in the outer (non-scrolling)
          wrapper so horizontal panning never displaces them from the time
          column's right edge. */}
      {showIndicator && rawIndicatorTop !== null ? (
        <>
          {/* Horizontal line: starts at time-column right edge, spans all visible day columns */}
          <div
            aria-hidden
            className="bg-brand/90 pointer-events-none absolute h-px"
            style={{
              left: "4rem",
              right: 0,
              top: rawIndicatorTop,
              zIndex: CURRENT_TIME_INDICATOR_Z,
            }}
          />
          {/* Dot: centred on the line, pinned to the time-column right edge */}
          <div
            aria-hidden
            className="bg-brand pointer-events-none absolute rounded-full"
            style={{
              width: 10,
              height: 10,
              left: "calc(4rem - 5px)",
              top: rawIndicatorTop - 5,
              zIndex: CURRENT_TIME_INDICATOR_Z,
            }}
          />
        </>
      ) : null}
      {debugEnabled ? (
        <div
          className="pointer-events-none fixed top-2 right-2 rounded-md border-2 border-lime-300 bg-black/90 px-3 py-2 font-mono text-[11px] leading-tight text-lime-200 shadow-lg"
          style={{ zIndex: 2147483646 }}
          data-testid="weekly-view-scroll-debug"
        >
          <div className="mb-1 font-bold text-lime-300">WEEK SCROLL DEBUG</div>
          {scrollDebugMetrics ? (
            <>
              <div>
                vw:{scrollDebugMetrics.viewportInnerWidth} mobile:
                {isMobile ? "Y" : "N"}
              </div>
              <div>
                sw:{scrollDebugMetrics.scrollWidth} cw:
                {scrollDebugMetrics.clientWidth}
              </div>
              <div>
                sl:{scrollDebugMetrics.scrollLeft} overflow:
                {overflowsHorizontally ? "YES" : "NO"}
              </div>
            </>
          ) : (
            <div>measuring… (ref not ready)</div>
          )}
        </div>
      ) : null}
      {/*
        Scroll container notes:
        - This element is intentionally a plain block (NOT flex). Making it
          `display: flex; flex-direction: column` causes iOS Safari and
          Android Chrome to ignore the inner child's `min-width` as a
          horizontal overflow trigger (flex cross-axis `stretch` clamps
          the child back to container width), which kills horizontal touch
          scrolling on phones.
        - The inner `gridContent` wrapper gets an explicit `width` (not just
          `min-width`) wider than the viewport on mobile. That is what makes
          the scroll container actually overflow horizontally so mobile
          browsers expose horizontal panning.
        - Do NOT add `scroll-snap-type` here. It interacts badly with
          sticky descendants on Android Chrome and iOS Safari and silently
          locks horizontal touch panning.
        - `DaysHeader` (top) and `TimeGridRow` time rail (left) are BOTH
          `position: sticky` on every device. Older engines (pre ~2022)
          had bugs where sticky descendants of a two-axis `overflow: auto`
          container could break horizontal touch panning, but current iOS
          Safari and Android Chrome handle this correctly.
        - `touch-action: pan-x pan-y` is set explicitly so the browser
          promises both pan directions to this element even if an ancestor
          has a more restrictive computed value.
      */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Scroll container clears hover state when pointer exits grid area */}
      <div
        ref={gridScrollRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-auto"
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y",
        }}
        onScroll={() => {
          setScrollTop(gridScrollRef.current?.scrollTop ?? 0);
        }}
        onMouseLeave={() => {
          setHoveredPostKey(null);
          setHoverOverlayPayload(null);
        }}
      >
        <div
          className="flex min-h-[40vh] flex-col select-none"
          style={
            isMobile
              ? { width: gridMinWidth, minWidth: gridMinWidth }
              : { minWidth: gridMinWidth, width: "100%" }
          }
        >
          <DaysHeader
            weekDays={weekDays}
            user={user}
            dateLocale={dateLocale}
            isMobile={isMobile}
            stickyTop={true}
          />
          <TimeGrid {...commonTimeGridProps} isMobile={isMobile} />
        </div>
      </div>
    </div>
  );
}
