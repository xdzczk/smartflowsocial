import { useMemo, useState } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { isVideoFile } from "~/lib/helpers";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import {
  addDays,
  createZonedDateTime,
  fromDate,
  nowInTimezone,
  toDate,
} from "~/lib/temporal";

import type { QueueType, UserData } from "../../types";
import { CONTENT_MOBILE_BREAKPOINT_PX } from "../constants";

import {
  buildDropIsoString,
  isCalendarDropSlotInPast,
} from "./calendar-helpers";
import { DateGrid } from "./components/DateGrid";
import type { CalendarDay } from "./components/DateGrid";
import { parseDropToDateTime } from "./data/parse-drop-to-date-time";
import { postsToDateGrid } from "./data/posts-to-date-grid";
import type { PostsByDate } from "./data/posts-to-date-grid";
import type { CalendarPost } from "./PostBlock.types";
import {
  getDisplayTime,
  getFirstImage,
  getQueueColorStyle,
  getQueueColorStyleProps,
} from "./PostBlock.utils";

interface MonthlyViewProps {
  scheduledPosts: CalendarPost[];
  pastPosts?: CalendarPost[];
  currentDate: Date;
  onPostDrop: (post: CalendarPost, newDateTime: Date) => void;
  onPostEdit: (post: CalendarPost) => void;
  onOpenDay?: (date: Date) => void;
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
}

/** Slot placement in a fixed 2×3 grid: row (0–2), col (0–1), colSpan is always 1. */
interface SlotPlacement {
  row: number;
  col: number;
  colSpan: number;
}

const MONTHLY_CELL_LAYOUT: SlotPlacement[] = [
  { row: 0, col: 0, colSpan: 1 },
  { row: 0, col: 1, colSpan: 1 },
  { row: 1, col: 0, colSpan: 1 },
  { row: 1, col: 1, colSpan: 1 },
  { row: 2, col: 0, colSpan: 1 },
  { row: 2, col: 1, colSpan: 1 },
];

const MAX_POSTS_PER_DAY = 6;
const MORE_SLOT_INDEX = 5;

interface MonthlyPostTileProps {
  post: CalendarPost;
  userTimezone: string;
  formatDate: ReturnType<typeof useFormattedDate>["formatDate"];
  postIsLongform: boolean;
  postIsPast: boolean;
  queueTypes?: QueueType[];
  onPostEdit: (post: CalendarPost) => void;
  isMobile: boolean;
}

function MonthlyPostTile({
  post,
  userTimezone,
  formatDate,
  postIsLongform,
  postIsPast,
  queueTypes,
  onPostEdit,
  isMobile,
}: MonthlyPostTileProps) {
  const displayTime = getDisplayTime(post, postIsLongform, postIsPast);
  const timeString = formatDate(displayTime, {
    timezone: userTimezone,
    dateFormatOptions: { hour: "2-digit", minute: "2-digit" },
  });
  const mediaUrl = getFirstImage(post, postIsLongform);
  const queueColorStyle = getQueueColorStyle(
    post,
    queueTypes,
    postIsLongform,
    postIsPast,
    true
  );
  const { style: tileStyle, unassignedBgClass } =
    getQueueColorStyleProps(queueColorStyle);
  const fallbackBgClass = queueColorStyle
    ? ""
    : "bg-muted/35 hover:bg-muted/55";
  const opacityClass = postIsPast
    ? "opacity-70 hover:opacity-100 focus-visible:opacity-100"
    : "opacity-100";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPostEdit(post);
      }}
      className={`focus:ring-ring flex h-full w-full min-w-0 items-center justify-center rounded-[var(--calendar-radius-sm)] px-1.5 py-1 text-left transition-[opacity,background-color] focus:ring-2 focus:outline-none ${fallbackBgClass} ${unassignedBgClass} ${opacityClass} ${
        isMobile ? "p-0.5" : "p-1"
      }`}
      title={
        isMobile ? "Open post details" : `${timeString} — Open post details`
      }
      style={queueColorStyle ? tileStyle : undefined}
    >
      <div
        className={`flex w-full items-center justify-center ${
          isMobile ? "" : "gap-1.5"
        }`}
      >
        {!isMobile ? (
          <span className="text-primary flex-shrink-0 text-[11px] font-semibold tabular-nums">
            {timeString}
          </span>
        ) : null}
        <div
          className={`bg-muted relative overflow-hidden rounded-[var(--calendar-radius-sm)] ${
            isMobile ? "h-6 w-6" : "h-5 w-5 flex-shrink-0"
          }`}
        >
          {mediaUrl ? (
            <MediaThumbnail
              src={mediaUrl}
              alt=""
              className="h-full w-full object-cover"
              forceType={isVideoFile(mediaUrl) ? "video" : "image"}
              hidePlayButton={true}
              fallback={
                <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-[10px]">
                  {isVideoFile(mediaUrl) ? "VIDEO" : "IMG"}
                </div>
              }
            />
          ) : (
            <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-[10px]">
              IMG
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function MonthlyView({
  scheduledPosts,
  pastPosts = [],
  currentDate,
  onPostDrop,
  onPostEdit,
  onOpenDay,
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
}: MonthlyViewProps) {
  const userTimezone = user?.timezone ?? "Etc/UTC";
  const { formatDate } = useFormattedDate();
  const isMobile = useIsMobile(CONTENT_MOBILE_BREAKPOINT_PX);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);

  const calendarDays = useMemo((): CalendarDay[] => {
    const currentZoned = fromDate(currentDate, "UTC");
    const year = currentZoned.year;
    const month = currentZoned.month;
    const firstDayZoned = createZonedDateTime(year, month, 1, 0, 0, "UTC");
    const dayOfWeek = firstDayZoned.dayOfWeek;
    const daysFromMonday = dayOfWeek === 7 ? 6 : dayOfWeek - 1;
    const startDateZoned = addDays(firstDayZoned, -daysFromMonday);
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

  const postsByDate = useMemo(
    (): PostsByDate =>
      postsToDateGrid(scheduledPosts, pastPosts, {
        userTimezone,
        isLongform,
        isAll,
      }),
    [scheduledPosts, pastPosts, userTimezone, isLongform, isAll]
  );

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, date: Date) => {
    const dateZoned = fromDate(date, userTimezone);
    const dateKey = `${dateZoned.year}-${String(dateZoned.month).padStart(2, "0")}-${String(dateZoned.day).padStart(2, "0")}`;
    setDragOverDateKey(null);
    if (isCalendarDropSlotInPast(dateKey, "09:00", userTimezone)) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    const postData = JSON.parse(
      e.dataTransfer.getData("text/plain")
    ) as CalendarPost;
    const postIsLongform = isAll
      ? Boolean(postData.title && postData.publishedAt)
      : isLongform;
    const postIsPast =
      typeof postData.isPast === "boolean" ? postData.isPast : false;
    const postDisplayTime = getDisplayTime(
      postData,
      postIsLongform,
      postIsPast
    );
    const postDateZoned = fromDate(postDisplayTime, userTimezone);
    const postDateKey = `${postDateZoned.year}-${String(postDateZoned.month).padStart(2, "0")}-${String(postDateZoned.day).padStart(2, "0")}`;
    if (postDateKey === dateKey) {
      return;
    }
    const isoString = buildDropIsoString(dateKey, "09:00");
    const newDateTime = parseDropToDateTime(isoString, userTimezone);
    onPostDrop(postData, newDateTime);
  };

  const getCellContent = (
    dateKey: string,
    posts: CalendarPost[],
    dayInfo: CalendarDay
  ) => {
    const hasOverflow = posts.length > MAX_POSTS_PER_DAY;
    const postsToShow = hasOverflow
      ? posts.slice(0, MORE_SLOT_INDEX)
      : posts.slice(0, MAX_POSTS_PER_DAY);
    const remainingCount = hasOverflow
      ? Math.max(0, posts.length - MORE_SLOT_INDEX)
      : 0;
    const layout = MONTHLY_CELL_LAYOUT;

    return (
      <>
        <div
          className={`font-medium ${
            isMobile ? "mb-0.5 text-xs" : "mb-1 text-sm"
          } ${
            dayInfo.isToday
              ? "text-foreground"
              : dayInfo.isCurrentMonth
                ? "text-foreground"
                : "text-muted-foreground"
          }`}
        >
          {dayInfo.date.getDate()}
        </div>
        <div
          className={`grid min-h-0 min-w-0 flex-1 grid-cols-2 grid-rows-3 overflow-hidden ${
            isMobile ? "gap-px" : "gap-0.5"
          }`}
        >
          {layout.map((placement, slotIndex) => {
            const { row, col, colSpan } = placement;
            const isMoreLabel = hasOverflow && slotIndex === MORE_SLOT_INDEX;
            const post = !isMoreLabel ? postsToShow[slotIndex] : undefined;
            const gridRow = row + 1;
            return (
              <div
                key={
                  post?.id ??
                  (isMoreLabel
                    ? `more-${dateKey}`
                    : `slot-${row}-${col}-${colSpan}`)
                }
                className="min-h-0 min-w-0 overflow-hidden"
                style={{
                  gridRowStart: gridRow,
                  gridRowEnd: gridRow,
                  gridColumnStart: colSpan === 2 ? 1 : col + 1,
                  gridColumnEnd: colSpan === 2 ? -1 : col + 2,
                }}
              >
                {isMoreLabel ? (
                  <div
                    className={`text-muted-foreground/80 border-border/30 flex h-full min-h-0 items-center justify-center rounded-[var(--calendar-radius-sm)] border border-dashed ${
                      isMobile
                        ? "px-1 py-0.5 text-[10px]"
                        : "px-2 py-1 text-[11px]"
                    }`}
                  >
                    +{remainingCount > 9 ? "9" : remainingCount} more
                  </div>
                ) : post ? (
                  (() => {
                    const postIsLongform = isAll
                      ? Boolean(post.title && post.publishedAt)
                      : isLongform;
                    const postIsPast =
                      typeof post.isPast === "boolean" ? post.isPast : false;
                    return (
                      <MonthlyPostTile
                        key={post.id}
                        post={post}
                        userTimezone={userTimezone}
                        formatDate={formatDate}
                        postIsLongform={postIsLongform}
                        postIsPast={postIsPast}
                        queueTypes={queueTypes}
                        onPostEdit={onPostEdit}
                        isMobile={isMobile}
                      />
                    );
                  })()
                ) : null}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const cellClassName = (dayInfo: CalendarDay) =>
    `border-border/40 flex min-h-[120px] flex-col border-r border-b last:border-r-0 transition-colors ${
      isMobile ? "px-1 py-1" : "px-2 py-1.5"
    } ${
      dayInfo.isCurrentMonth
        ? "bg-[hsl(var(--calendar-surface-2-bg))]"
        : "bg-secondary/20"
    } ${
      dragOverDateKey ===
      `${fromDate(dayInfo.date, userTimezone).year}-${String(fromDate(dayInfo.date, userTimezone).month).padStart(2, "0")}-${String(fromDate(dayInfo.date, userTimezone).day).padStart(2, "0")}`
        ? "bg-primary/5 ring-primary/40 ring-1"
        : ""
    } ${dayInfo.isToday ? "ring-primary ring-1" : ""}`;

  return (
    <DateGrid
      calendarDays={calendarDays}
      postsByDate={postsByDate}
      getCellContent={getCellContent}
      onDrop={handleDrop}
      onCellClick={onOpenDay}
      onCellDragOver={(date) => {
        const zoned = fromDate(date, userTimezone);
        const key = `${zoned.year}-${String(zoned.month).padStart(2, "0")}-${String(zoned.day).padStart(2, "0")}`;
        setDragOverDateKey(key);
      }}
      onCellDragLeave={() => {
        setDragOverDateKey(null);
      }}
      canDropDate={(date) => {
        const dateZoned = fromDate(date, userTimezone);
        const dateKey = `${dateZoned.year}-${String(dateZoned.month).padStart(2, "0")}-${String(dateZoned.day).padStart(2, "0")}`;
        return !isCalendarDropSlotInPast(dateKey, "09:00", userTimezone);
      }}
      weekdayLabels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
      userTimezone={userTimezone}
      cellClassName={cellClassName}
    />
  );
}
