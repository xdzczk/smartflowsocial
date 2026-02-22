/**
 * Day view: single-day time grid. Uses dedicated two-column layout (Option 2);
 * does not delegate to WeeklyView.
 */

import { useMemo, useState, useRef, useEffect } from "react";

import { fromDate } from "~/lib/temporal";

import type { QueueType, UserData } from "../../../types";
import { DayViewTwoColumnGrid } from "../components/DayViewTwoColumnGrid";
import {
  DEFAULT_SCROLL_HOUR,
  HOURS_PER_DAY,
  ROW_HEIGHT_PX,
} from "../components/weekly-view-constants";
import {
  getDayViewColumnPlacements,
  getDayViewEmptySlotRowIndices,
  getMultiPostRows,
} from "../data/day-view-placements";
import { postsToTimeGrid } from "../data/posts-to-time-grid";
import { getDayViewColumnMap } from "../domain/day-view-column-map";
import type { CalendarPost } from "../PostBlock.types";

export interface DayViewProps {
  scheduledPosts: CalendarPost[];
  pastPosts?: CalendarPost[];
  currentDate: Date;
  onPostDrop: (post: CalendarPost, newDateTime: Date) => void;
  onPostEdit: (post: CalendarPost) => void;
  selectedPost?: CalendarPost | null;
  onClearSelection?: () => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
}

export function DayView({
  scheduledPosts,
  pastPosts = [],
  currentDate,
  onPostDrop,
  onPostEdit,
  selectedPost,
  onClearSelection,
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
}: DayViewProps) {
  const [activeEmptySlotKey, setActiveEmptySlotKey] = useState<string | null>(
    null
  );
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const hasSetInitialScrollRef = useRef(false);

  const userTimezone = user?.timezone ?? "Etc/UTC";
  const userTimeFormat =
    user && typeof user === "object" && "timeFormat" in user
      ? user.timeFormat === "24h"
        ? "24h"
        : "12h"
      : "12h";

  const dateKey = useMemo(() => {
    const dayZoned = fromDate(currentDate, userTimezone);
    return `${dayZoned.year}-${String(dayZoned.month).padStart(2, "0")}-${String(dayZoned.day).padStart(2, "0")}`;
  }, [currentDate, userTimezone]);

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

  const postsGrid = useMemo(
    () =>
      postsToTimeGrid(scheduledPosts, pastPosts, [dateKey], hours, {
        userTimezone,
        isLongform,
        isAll,
      }),
    [scheduledPosts, pastPosts, dateKey, hours, userTimezone, isLongform, isAll]
  );

  const dayViewColumnMap = useMemo(
    () => getDayViewColumnMap(postsGrid, dateKey, hours),
    [postsGrid, dateKey, hours]
  );

  const placements = useMemo(
    () =>
      getDayViewColumnPlacements(dateKey, hours, postsGrid, dayViewColumnMap),
    [dateKey, hours, postsGrid, dayViewColumnMap]
  );

  const multiPostRows = useMemo(
    () => getMultiPostRows(dateKey, hours, postsGrid),
    [dateKey, hours, postsGrid]
  );

  const emptySlotRowIndices = useMemo(
    () =>
      getDayViewEmptySlotRowIndices(placements, multiPostRows, hours.length),
    [placements, multiPostRows, hours.length]
  );

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
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
        <div className="flex min-h-0 min-h-[40vh] flex-1 flex-col overflow-hidden select-none">
          <DayViewTwoColumnGrid
            dateKey={dateKey}
            currentDate={currentDate}
            hours={hours}
            hourLabels={hourLabels}
            placements={placements}
            multiPostRows={multiPostRows}
            emptySlotRowIndices={emptySlotRowIndices}
            gridScrollRef={gridScrollRef}
            onPostDrop={onPostDrop}
            onPostEdit={onPostEdit}
            selectedPost={selectedPost}
            activeEmptySlotKey={activeEmptySlotKey}
            setActiveEmptySlotKey={setActiveEmptySlotKey}
            onClearSelection={onClearSelection}
            user={user}
            queueTypes={queueTypes}
            isLongform={isLongform}
            isAll={isAll}
          />
        </div>
      </div>
    </div>
  );
}
