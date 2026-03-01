import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { calendarKeys } from "~/features/posts/hooks/useCalendarQuery";
import { useRefreshPostViews } from "~/features/posts/hooks/useRefreshPostViews";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import {
  addDays,
  addMonths,
  createZonedDateTime,
  formatForDisplay,
  fromDate,
  fromISOString,
  fromUnixTimestamp,
  nowInTimezone,
  nowUTC,
  toDate,
} from "~/lib/temporal";

import type { QueueType, UserData } from "../../types";
import LongFormDetailsModal from "../LongFormDetailsModal";
import PostDetailsModal from "../PostDetailsModal";
import PostTypeTabs from "../PostTypeTabs";
import QueueSelectionTabs from "../QueueSelectionTabs";

import { getPostIsLongform, isSameCalendarSlot } from "./calendar-helpers";
import { CalendarErrorBoundary } from "./CalendarErrorBoundary";
import { DayViewSidebar, useIsLg } from "./DayViewSidebar";
import { MonthlyView } from "./MonthlyView";
import type { CalendarPost } from "./PostBlock.types";
import { getPostScheduleInstant } from "./PostBlock.utils";
import { RescheduleModal } from "./RescheduleModal";
import { DayView } from "./views/DayView";
import { WeekView } from "./views/WeekView";

interface RescheduleData {
  post: CalendarPost;
  newDateTime: Date;
  wasAutoScheduled: boolean;
  queueName: string | null;
  isEdit: boolean;
  isLongform: boolean;
}

interface CalendarProps {
  scheduledPosts: CalendarPost[];
  pastPosts?: CalendarPost[];
  user?: UserData | null;
  queueTypes?: QueueType[];
  isLongform?: boolean;
  isAll?: boolean;
  /** When set, content-type tabs and queue filter are rendered inside the calendar header (main calendar page). */
  calendarPageTabs?: {
    currentTab: string;
    basePath: string;
    totalContentCount?: number;
    totalPostsCount?: number;
    totalRepostsCount?: number;
    totalLongformCount?: number;
  };
  /** Optional initial view when opening from URL (e.g. from Next 7 days day row). */
  initialView?: "day" | "week" | "month";
  /** Optional initial date (YYYY-MM-DD) when opening from URL. */
  initialDate?: string;
}

const VIEW_VALUES = ["day", "week", "month"] as const;

function getCalendarPostModalType(
  post: CalendarPost
): "published" | "scheduled" {
  if (post.isPast || post.isPosted) return "published";
  const publishedAtMs = post.publishedAt
    ? new Date(post.publishedAt).getTime()
    : 0;
  if (publishedAtMs > 0 && publishedAtMs <= Date.now()) return "published";
  return "scheduled";
}

function parseInitialDate(
  initialDate: string | null | undefined,
  userTimezone: string
): Date {
  if (!initialDate || !/^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
    const now = nowInTimezone(userTimezone);
    return toDate(now);
  }
  const parsed = new Date(initialDate + "T12:00:00.000Z");
  return Number.isNaN(parsed.getTime())
    ? toDate(nowInTimezone(userTimezone))
    : parsed;
}

export function Calendar({
  scheduledPosts,
  pastPosts = [],
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
  calendarPageTabs,
  initialView,
  initialDate,
}: CalendarProps) {
  const { dateLocale } = useFormattedDate();
  const userTimezone = user?.timezone ?? "Etc/UTC";
  const [view, setView] = useState<"day" | "week" | "month">(() => {
    if (initialView && VIEW_VALUES.includes(initialView)) return initialView;
    return "week";
  });
  const [currentDate, setCurrentDate] = useState(() =>
    parseInitialDate(initialDate, userTimezone)
  );
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<RescheduleData | null>(
    null
  );
  const [miniCalendarOpen, setMiniCalendarOpen] = useState(false);
  const [miniCalendarMonth, setMiniCalendarMonth] = useState<Date>(() => {
    const now = nowInTimezone(user?.timezone ?? "Etc/UTC");
    return toDate(now);
  });
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);
  const [detailModalPost, setDetailModalPost] = useState<CalendarPost | null>(
    null
  );
  const [calendarLiveMessage, setCalendarLiveMessage] = useState("");
  const isLg = useIsLg();
  const queryClient = useQueryClient();
  const refreshPostViews = useRefreshPostViews();

  useEffect(() => {
    if (!calendarLiveMessage) return;
    const t = setTimeout(() => setCalendarLiveMessage(""), 3000);
    return () => clearTimeout(t);
  }, [calendarLiveMessage]);

  const handlePostDrop = useCallback(
    (post: CalendarPost, newDateTime: Date) => {
      const postIsLongform = getPostIsLongform(post, isLongform, isAll);
      const wasAutoScheduled = postIsLongform ? false : !post.manual_override;

      const postIsPast = typeof post.isPast === "boolean" ? post.isPast : false;
      const currentMs = getPostScheduleInstant(
        post,
        postIsLongform,
        postIsPast
      );
      if (
        currentMs != null &&
        isSameCalendarSlot(currentMs, newDateTime, userTimezone)
      ) {
        return;
      }

      setRescheduleData({
        post,
        newDateTime,
        wasAutoScheduled,
        queueName: postIsLongform ? null : (post.queueType?.name ?? null),
        isEdit: false,
        isLongform: postIsLongform,
      });
      setShowRescheduleModal(true);
      setCalendarLiveMessage(
        `Post moved to ${formatForDisplay(
          fromDate(newDateTime, userTimezone),
          userTimezone,
          {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          },
          undefined,
          dateLocale
        )}`
      );
    },
    [isLongform, isAll, userTimezone, dateLocale]
  );

  const isDetailModalOpen = detailModalPost !== null;
  const detailModalPostIsLongform =
    detailModalPost !== null
      ? getPostIsLongform(detailModalPost, isLongform, isAll)
      : false;
  const detailModalType =
    detailModalPost !== null
      ? getCalendarPostModalType(detailModalPost)
      : "scheduled";

  // Keyboard shortcuts: T = Today, Left/Right = prev/next period (ignore when modal open or focus in input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showRescheduleModal || isDetailModalOpen) return;
      const target = document.activeElement;
      if (
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (target as HTMLElement).tagName
        )
      ) {
        return;
      }
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setSelectedPost(null);
        setCurrentDate(toDate(nowInTimezone(userTimezone)));
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const currentZoned = fromDate(currentDate, userTimezone);
        const newZoned =
          view === "day"
            ? addDays(currentZoned, -1)
            : view === "week"
              ? addDays(currentZoned, -7)
              : addMonths(currentZoned, -1);
        setSelectedPost(null);
        setCurrentDate(toDate(newZoned));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const currentZoned = fromDate(currentDate, userTimezone);
        const newZoned =
          view === "day"
            ? addDays(currentZoned, 1)
            : view === "week"
              ? addDays(currentZoned, 7)
              : addMonths(currentZoned, 1);
        setSelectedPost(null);
        setCurrentDate(toDate(newZoned));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showRescheduleModal, isDetailModalOpen, currentDate, view, userTimezone]);

  const handlePostEdit = useCallback(
    (post: CalendarPost) => {
      const postIsLongform = getPostIsLongform(post, isLongform, isAll);
      const wasAutoScheduled = postIsLongform ? false : !post.manual_override;
      // For longform posts, use publishedAt instead of scheduledFor
      const currentDateTime = postIsLongform
        ? (() => {
            try {
              const zoned = fromISOString(post.publishedAt as string, "UTC");
              return toDate(zoned);
            } catch {
              return toDate(nowUTC());
            }
          })()
        : (() => {
            try {
              const timestamp = Number(post.scheduledFor);
              if (!isNaN(timestamp)) {
                const zoned = fromUnixTimestamp(timestamp, "UTC");
                return toDate(zoned);
              }
              return toDate(nowUTC());
            } catch {
              return toDate(nowUTC());
            }
          })();

      setRescheduleData({
        post,
        newDateTime: currentDateTime,
        wasAutoScheduled,
        queueName: postIsLongform ? null : (post.queueType?.name ?? null),
        isEdit: true,
        isLongform: postIsLongform,
      });
      setShowRescheduleModal(true);
      setCalendarLiveMessage(
        `Editing post scheduled for ${formatForDisplay(
          fromDate(currentDateTime, userTimezone),
          userTimezone,
          {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          },
          undefined,
          dateLocale
        )}`
      );
    },
    [isLongform, isAll, userTimezone, dateLocale]
  );

  const handlePostClick = useCallback(
    (post: CalendarPost) => {
      if (view === "day" && isLg) {
        setSelectedPost(post);
      } else {
        setDetailModalPost(post);
      }
    },
    [view, isLg]
  );

  const userTimeFormat =
    user && typeof user === "object" && "timeFormat" in user
      ? user.timeFormat === "24h"
        ? "24h"
        : "12h"
      : "12h";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[hsl(var(--calendar-surface-2-bg))]">
      {/* Screen reader: announce drop/edit result */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {calendarLiveMessage}
      </div>
      {/* Header: mobile = row1 (nav + Today + view), row2 (content 50% + queue 50%); desktop = single row. Calendar controls use text-sm to match content type and queue filter labels. */}
      <div className="border-border/60 flex min-h-14 flex-col justify-center border-b bg-[hsl(var(--calendar-surface-1-bg))] px-2 py-3 select-none sm:px-3">
        <div className="flex h-fit min-h-0 flex-shrink-0 flex-col justify-center gap-2 md:flex-row md:flex-nowrap md:items-center md:gap-4">
          {/* Row 1 on mobile: calendar controls + Today + view selector */}
          <div className="flex w-full min-w-0 items-center justify-between gap-2 md:w-auto md:flex-shrink-0">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                onClick={() => {
                  const currentZoned = fromDate(currentDate, userTimezone);
                  const newZoned =
                    view === "day"
                      ? addDays(currentZoned, -1)
                      : view === "week"
                        ? addDays(currentZoned, -7)
                        : addMonths(currentZoned, -1);
                  setSelectedPost(null);
                  setCurrentDate(toDate(newZoned));
                }}
                className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex h-9 min-w-9 shrink-0 items-center justify-center rounded-[var(--calendar-radius-sm)] p-1.5 sm:p-2"
                aria-label="Previous"
              >
                <ChevronLeft
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </button>

              <button
                onClick={() => {
                  const now = nowInTimezone(userTimezone);
                  setSelectedPost(null);
                  setCurrentDate(toDate(now));
                }}
                className="text-primary hover:text-primary/80 bg-muted/50 flex h-9 shrink-0 items-center rounded-[var(--calendar-radius-sm)] px-2 py-1.5 text-sm font-medium sm:px-3"
                title="Today (T)"
              >
                Today
              </button>

              <button
                onClick={() => {
                  const currentZoned = fromDate(currentDate, userTimezone);
                  const newZoned =
                    view === "day"
                      ? addDays(currentZoned, 1)
                      : view === "week"
                        ? addDays(currentZoned, 7)
                        : addMonths(currentZoned, 1);
                  setSelectedPost(null);
                  setCurrentDate(toDate(newZoned));
                }}
                className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex h-9 min-w-9 shrink-0 items-center justify-center rounded-[var(--calendar-radius-sm)] p-1.5 sm:p-2"
                aria-label="Next"
              >
                <ChevronRight
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
              </button>

              {/* Mini calendar: in Day view only. On desktop (lg) it lives in the sidebar; below lg use header popover */}
              {view === "day" ? (
                <div className="lg:hidden">
                  <Popover
                    open={miniCalendarOpen}
                    onOpenChange={(open) => {
                      setMiniCalendarOpen(open);
                      if (open) setMiniCalendarMonth(currentDate);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex h-9 min-w-9 items-center justify-center rounded-[var(--calendar-radius-sm)] p-1.5 sm:p-2"
                        aria-label="Pick a date"
                      >
                        <CalendarDays
                          className="h-4 w-4 sm:h-5 sm:w-5"
                          strokeWidth={INLINE_ICON_STROKE}
                          aria-hidden
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto rounded-[var(--calendar-radius-md)] border-[hsl(var(--calendar-surface-2-border))] bg-[hsl(var(--calendar-surface-2-bg))] p-3"
                      align="end"
                    >
                      <MiniCalendarGrid
                        displayedMonth={miniCalendarMonth}
                        currentDate={currentDate}
                        userTimezone={userTimezone}
                        dateLocale={dateLocale}
                        onMonthChange={setMiniCalendarMonth}
                        onSelectDate={(date) => {
                          setSelectedPost(null);
                          setCurrentDate(date);
                          setMiniCalendarOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : null}
            </div>

            {/* Month label on mobile only: between < Today > and Day/Week/Month switch (Month and Week views) */}
            {view === "month" || view === "week" ? (
              <h2 className="text-foreground flex min-w-0 flex-1 items-center justify-center truncate text-sm leading-tight font-medium max-md:flex md:hidden">
                {formatForDisplay(
                  fromDate(currentDate, userTimezone),
                  userTimezone,
                  { month: "long", year: "numeric" },
                  undefined,
                  dateLocale
                )}
              </h2>
            ) : null}

            {/* View toggle: same row on mobile, right side */}
            <div className="bg-muted/50 flex h-9 shrink-0 items-center gap-0.5 rounded-[var(--calendar-radius-sm)] p-0.5 sm:gap-1 sm:p-1">
              {(["day", "week", "month"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setSelectedPost(null);
                    setView(v);
                  }}
                  className={`flex h-8 items-center rounded-[var(--calendar-radius-sm)] px-1.5 py-0.5 text-sm font-medium sm:px-2 sm:py-1 md:px-3 ${
                    view === v
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {/* Month label: in Month and Week view, after Day/Week/Month controls (desktop); on mobile shown between nav and view toggle */}
            {view === "month" || view === "week" ? (
              <h2 className="text-foreground hidden min-w-0 items-center truncate text-sm leading-tight font-medium md:flex">
                {formatForDisplay(
                  fromDate(currentDate, userTimezone),
                  userTimezone,
                  { month: "long", year: "numeric" },
                  undefined,
                  dateLocale
                )}
              </h2>
            ) : null}
          </div>

          {/* Row 2 on mobile: content type 50% + queue 50%. On desktop: right-aligned, same-width filters */}
          {calendarPageTabs ? (
            <div className="border-border/60 flex w-full items-center gap-2 border-b-0 md:min-w-0 md:flex-1 md:justify-end">
              <div className="flex min-w-0 flex-1 justify-center md:w-40 md:min-w-40 md:flex-none md:[&_button]:w-full">
                <PostTypeTabs
                  currentTab={calendarPageTabs.currentTab}
                  basePath={calendarPageTabs.basePath}
                  totalContentCount={calendarPageTabs.totalContentCount}
                  totalPostsCount={calendarPageTabs.totalPostsCount}
                  totalRepostsCount={calendarPageTabs.totalRepostsCount}
                  totalLongformCount={calendarPageTabs.totalLongformCount}
                  inRow
                  forceDropdown
                />
              </div>
              {["all", "posts", "reposts", "longform"].includes(
                calendarPageTabs.currentTab
              ) && queueTypes ? (
                <div className="flex min-w-0 flex-1 justify-center md:w-40 md:min-w-40 md:flex-none md:[&_button]:w-full">
                  <QueueSelectionTabs
                    currentTab={calendarPageTabs.currentTab}
                    queueTypes={queueTypes}
                    basePath={calendarPageTabs.basePath}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Calendar content: Day view on lg shows main + right sidebar */}
      <div className="flex min-h-0 flex-1 overflow-x-visible overflow-y-hidden">
        <CalendarErrorBoundary>
          <div
            data-testid={`calendar-view-${view}`}
            className={`flex min-h-0 flex-1 transition-opacity duration-200 ${
              view === "day" ? "lg:min-w-0 lg:flex-row" : ""
            } flex-col`}
            style={{
              transitionTimingFunction: "var(--calendar-transition-ease)",
            }}
          >
            <div
              className={`flex min-h-0 flex-1 flex-col ${
                view === "day" ? "lg:min-w-0" : "min-w-0"
              }`}
            >
              {view === "day" ? (
                <DayView
                  scheduledPosts={scheduledPosts}
                  pastPosts={pastPosts}
                  currentDate={currentDate}
                  onPostDrop={handlePostDrop}
                  onPostEdit={handlePostClick}
                  selectedPost={selectedPost}
                  onClearSelection={() => setSelectedPost(null)}
                  user={user}
                  queueTypes={queueTypes}
                  isLongform={isLongform}
                  isAll={isAll}
                  dateLocale={dateLocale}
                />
              ) : view === "week" ? (
                <WeekView
                  scheduledPosts={scheduledPosts}
                  pastPosts={pastPosts}
                  currentDate={currentDate}
                  onPostDrop={handlePostDrop}
                  onPostEdit={handlePostClick}
                  user={user}
                  queueTypes={queueTypes}
                  isLongform={isLongform}
                  isAll={isAll}
                />
              ) : (
                <MonthlyView
                  scheduledPosts={scheduledPosts}
                  pastPosts={pastPosts}
                  currentDate={currentDate}
                  onPostDrop={handlePostDrop}
                  onPostEdit={handlePostClick}
                  onOpenDay={(date) => {
                    setSelectedPost(null);
                    setDetailModalPost(null);
                    setCurrentDate(date);
                    setView("day");
                  }}
                  user={user}
                  queueTypes={queueTypes}
                  isLongform={isLongform}
                  isAll={isAll}
                />
              )}
            </div>
            {view === "day" ? (
              <div className="hidden flex-shrink-0 lg:flex">
                <DayViewSidebar
                  selectedPost={selectedPost}
                  onEditPost={handlePostEdit}
                  user={user}
                  queueTypes={queueTypes}
                  isLongform={isLongform}
                  isAll={isAll}
                  userTimezone={userTimezone}
                  userTimeFormat={userTimeFormat}
                >
                  <MiniCalendarGrid
                    displayedMonth={miniCalendarMonth}
                    currentDate={currentDate}
                    userTimezone={userTimezone}
                    dateLocale={dateLocale}
                    onMonthChange={setMiniCalendarMonth}
                    onSelectDate={(date) => {
                      setSelectedPost(null);
                      setCurrentDate(date);
                    }}
                  />
                </DayViewSidebar>
              </div>
            ) : null}
          </div>
        </CalendarErrorBoundary>
      </div>

      {/* Reschedule Modal */}
      {showRescheduleModal && rescheduleData ? (
        <RescheduleModal
          data={rescheduleData}
          user={user}
          queueTypes={queueTypes}
          onClose={() => {
            setShowRescheduleModal(false);
            setRescheduleData(null);
          }}
          onConfirm={() => {
            setShowRescheduleModal(false);
            setRescheduleData(null);
            void queryClient.refetchQueries({ queryKey: calendarKeys.all });
          }}
        />
      ) : null}

      {/* Details modal opened by clicking calendar blocks */}
      {detailModalPost && !detailModalPostIsLongform ? (
        <PostDetailsModal
          post={
            detailModalPost as Parameters<typeof PostDetailsModal>[0]["post"]
          }
          onClose={() => setDetailModalPost(null)}
          onDeleted={refreshPostViews}
          onReschedule={(post) => {
            setDetailModalPost(null);
            handlePostEdit(post as CalendarPost);
          }}
          showSignedEvent={true}
          type={detailModalType}
          userTimezone={userTimezone}
          userTimeFormat={userTimeFormat}
        />
      ) : null}
      {detailModalPost && detailModalPostIsLongform ? (
        <LongFormDetailsModal
          post={
            detailModalPost as unknown as Parameters<
              typeof LongFormDetailsModal
            >[0]["post"]
          }
          onClose={() => setDetailModalPost(null)}
          onDeleted={refreshPostViews}
          onReschedule={(post) => {
            setDetailModalPost(null);
            handlePostEdit(post as unknown as CalendarPost);
          }}
          type={detailModalType}
          showSignedEvent={true}
          userTimezone={userTimezone}
          userTimeFormat={userTimeFormat}
        />
      ) : null}
    </div>
  );
}

interface MiniCalendarGridProps {
  displayedMonth: Date;
  currentDate: Date;
  userTimezone: string;
  dateLocale: "en-GB" | "en-US" | "sv";
  onMonthChange: (date: Date) => void;
  onSelectDate: (date: Date) => void;
}

function MiniCalendarGrid({
  displayedMonth,
  currentDate,
  userTimezone,
  dateLocale,
  onMonthChange,
  onSelectDate,
}: MiniCalendarGridProps) {
  const days = useMemo(() => {
    const currentZoned = fromDate(displayedMonth, "UTC");
    const year = currentZoned.year;
    const month = currentZoned.month;
    const firstDayZoned = createZonedDateTime(year, month, 1, 0, 0, "UTC");
    const dayOfWeek = firstDayZoned.dayOfWeek;
    const daysFromMonday = dayOfWeek === 7 ? 6 : dayOfWeek - 1;
    const startDateZoned = addDays(firstDayZoned, -daysFromMonday);
    const todayZoned = nowInTimezone(userTimezone);
    const selectedZoned = fromDate(currentDate, userTimezone);
    const out: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];
    for (let i = 0; i < 42; i++) {
      const dateZoned = addDays(startDateZoned, i);
      const isToday =
        dateZoned.year === todayZoned.year &&
        dateZoned.month === todayZoned.month &&
        dateZoned.day === todayZoned.day;
      const isSelected =
        dateZoned.year === selectedZoned.year &&
        dateZoned.month === selectedZoned.month &&
        dateZoned.day === selectedZoned.day;
      out.push({
        date: toDate(dateZoned),
        isCurrentMonth: dateZoned.month === month,
        isToday,
        isSelected,
      });
    }
    return out;
  }, [displayedMonth, userTimezone, currentDate]);

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            onMonthChange(
              toDate(addMonths(fromDate(displayedMonth, "UTC"), -1))
            )
          }
          className="text-muted-foreground hover:text-foreground rounded-[var(--calendar-radius-sm)] p-1"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={INLINE_ICON_STROKE} />
        </button>
        <span className="text-sm font-medium">
          {formatForDisplay(
            fromDate(displayedMonth, "UTC"),
            userTimezone,
            { month: "long", year: "numeric" },
            undefined,
            dateLocale
          )}
        </span>
        <button
          type="button"
          onClick={() =>
            onMonthChange(toDate(addMonths(fromDate(displayedMonth, "UTC"), 1)))
          }
          className="text-muted-foreground hover:text-foreground rounded-[var(--calendar-radius-sm)] p-1"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={INLINE_ICON_STROKE} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {weekdays.map((d) => (
          <div
            key={d}
            className="text-muted-foreground py-0.5 text-xs font-medium"
          >
            {d}
          </div>
        ))}
        {days.map(({ date, isCurrentMonth, isToday, isSelected }) => (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onSelectDate(date)}
            className={`min-w-[28px] rounded-[var(--calendar-radius-sm)] py-1 text-xs ${
              !isCurrentMonth ? "text-muted-foreground/70" : "text-foreground"
            } ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : isToday
                  ? "ring-primary bg-primary/10 ring-1"
                  : "hover:bg-muted"
            }`}
          >
            {date.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}
