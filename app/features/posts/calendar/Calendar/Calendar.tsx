import { useNavigate, useSearchParams } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { calendarKeys } from "~/features/posts/calendar/hooks/useCalendarQuery";
import { getLongFormPublishedEventId } from "~/features/posts/components/post-detail-modal/post-detail-helpers";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import {
  PublishingContentTypeFilter,
  PublishingQueueFilter,
  PublishingSegmentedControlButtons,
  type PublishingSegmentButtonItem,
} from "~/features/posts/components/publishing-suite";
import { buildComposeEditUrl } from "~/features/posts/composer";
import { usePostStatsQuery } from "~/features/posts/hooks/usePostStatsQuery";
import { useRefreshPostViews } from "~/features/posts/hooks/useRefreshPostViews";
import { LongFormDetailsModal } from "~/features/posts/longform";
import {
  calendarPostAsLongFormEntity,
  calendarPostAsPostData,
  scheduledPostViewModelFromCalendarPost,
} from "~/features/posts/scheduled";
import {
  EditScheduledPostModal,
  RescheduleScheduledPostModal,
} from "~/features/posts/scheduling";
import type {
  LongFormPostData,
  PostData,
  QueueType,
  UserData,
} from "~/features/posts/types";
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
import { validateUserData } from "~/lib/validation/user-data";

import { buildCalendarContentTypeFilterItems } from "./build-calendar-content-type-filter-items";
import { getPostIsLongform, isSameCalendarSlot } from "./calendar-helpers";
import { CalendarErrorBoundary } from "./CalendarErrorBoundary";
import { DayViewSidebar, useIsLg } from "./DayViewSidebar";
import { MonthlyView } from "./MonthlyView";
import type { CalendarPost } from "./PostBlock.types";
import { getPostScheduleInstant } from "./PostBlock.utils";
import type { RescheduleData } from "./utils/reschedule-modal.utils";
import { DayView } from "./views/DayView";
import { WeekView } from "./views/WeekView";

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

function CalendarToolbar({
  view,
  onViewChange,
  currentDate,
  onToday,
  onPrevious,
  onNext,
  userTimezone,
  dateLocale,
  miniCalendarOpen,
  onMiniCalendarOpenChange,
  miniCalendarMonth,
  onMiniCalendarMonthChange,
  onMiniCalendarSelectDate,
  calendarPageTabs,
  queueTypes,
}: {
  view: "day" | "week" | "month";
  onViewChange: (v: "day" | "week" | "month") => void;
  currentDate: Date;
  onToday: () => void;
  onPrevious: () => void;
  onNext: () => void;
  userTimezone: string;
  dateLocale: "en-GB" | "en-US" | "en-CA";
  miniCalendarOpen: boolean;
  onMiniCalendarOpenChange: (open: boolean) => void;
  miniCalendarMonth: Date;
  onMiniCalendarMonthChange: (d: Date) => void;
  onMiniCalendarSelectDate: (d: Date) => void;
  calendarPageTabs?: CalendarProps["calendarPageTabs"];
  queueTypes?: QueueType[];
}) {
  const [searchParams] = useSearchParams();
  const showPeriodLabel = view === "month" || view === "week";
  const periodLabel = showPeriodLabel
    ? formatForDisplay(
        fromDate(currentDate, userTimezone),
        userTimezone,
        { month: "long", year: "numeric" },
        undefined,
        dateLocale
      )
    : null;

  const viewItems: PublishingSegmentButtonItem[] = [
    { id: "day", label: "Day", ariaLabel: "Day view" },
    { id: "week", label: "Week", ariaLabel: "Week view" },
    { id: "month", label: "Month", ariaLabel: "Month view" },
  ];

  return (
    <div className="border-border/60 flex min-h-14 flex-col justify-center border-b bg-[hsl(var(--calendar-surface-1-bg))] px-2 py-3 sm:px-3">
      <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {/* Left cluster: nav + view + period label */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onPrevious}
              aria-label="Previous"
            >
              <ChevronLeft
                className="h-4 w-4 sm:h-5 sm:w-5"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 px-3 text-sm shadow-none"
              onClick={onToday}
              title="Today (T)"
            >
              Today
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={onNext}
              aria-label="Next"
            >
              <ChevronRight
                className="h-4 w-4 sm:h-5 sm:w-5"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </Button>

            {/* Mini calendar: day view only (mobile header). */}
            {view === "day" ? (
              <div className="lg:hidden">
                <Popover
                  open={miniCalendarOpen}
                  onOpenChange={onMiniCalendarOpenChange}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      aria-label="Pick a date"
                    >
                      <CalendarDays
                        className="h-4 w-4 sm:h-5 sm:w-5"
                        strokeWidth={INLINE_ICON_STROKE}
                        aria-hidden
                      />
                    </Button>
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
                      onMonthChange={onMiniCalendarMonthChange}
                      onSelectDate={onMiniCalendarSelectDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ) : null}
          </div>

          <PublishingSegmentedControlButtons
            items={viewItems}
            value={view}
            onValueChange={(next) => onViewChange(next as typeof view)}
            radiogroupAriaLabel="Calendar view"
            className="shrink-0"
            rowHeightClassName="h-9"
            data-testid="calendar-view-switcher"
          />

          {periodLabel ? (
            <h2 className="text-text min-w-0 truncate text-sm leading-tight font-medium">
              {periodLabel}
            </h2>
          ) : null}
        </div>

        {/* Right cluster: type + queue filters (Calendar main page only). */}
        {calendarPageTabs ? (
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 md:flex md:w-auto md:items-center md:justify-end">
            <div className="min-w-0">
              <PublishingContentTypeFilter
                value={calendarPageTabs.currentTab}
                ariaLabel="Filter by content type"
                items={buildCalendarContentTypeFilterItems({
                  basePath: calendarPageTabs.basePath,
                  searchParams,
                  totals: {
                    all: calendarPageTabs.totalContentCount ?? 0,
                    posts: calendarPageTabs.totalPostsCount ?? 0,
                    reposts: calendarPageTabs.totalRepostsCount ?? 0,
                    longform: calendarPageTabs.totalLongformCount ?? 0,
                  },
                })}
                data-testid="calendar-filter-type"
                triggerClassName="w-full sm:w-[14rem]"
              />
            </div>
            {queueTypes ? (
              <div className="min-w-0">
                <PublishingQueueFilter
                  currentTab={calendarPageTabs.currentTab}
                  basePath={calendarPageTabs.basePath}
                  queueTypes={queueTypes}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [postToEdit, setPostToEdit] = useState<
    PostData | LongFormPostData | null
  >(null);
  const [calendarLiveMessage, setCalendarLiveMessage] = useState("");
  const isLg = useIsLg();
  const queryClient = useQueryClient();
  const refreshPostViews = useRefreshPostViews();
  const navigate = useNavigate();

  const calendarPostsForStats = useMemo(() => {
    const merged = [...scheduledPosts, ...pastPosts];
    const shortPosts: PostData[] = [];
    const longFormPosts: LongFormPostData[] = [];
    for (const p of merged) {
      if (getPostIsLongform(p, isLongform, isAll)) {
        longFormPosts.push(calendarPostAsLongFormEntity(p));
      } else {
        shortPosts.push(calendarPostAsPostData(p));
      }
    }
    return { shortPosts, longFormPosts };
  }, [scheduledPosts, pastPosts, isLongform, isAll]);

  const { stats: calendarStatsMerged } = usePostStatsQuery(
    calendarPostsForStats.shortPosts,
    { longFormPosts: calendarPostsForStats.longFormPosts }
  );

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

  const detailModalPublishedStats = useMemo(() => {
    if (!detailModalPost || detailModalType !== "published") return;
    if (detailModalPostIsLongform) {
      const lf = calendarPostAsLongFormEntity(detailModalPost);
      const id = getLongFormPublishedEventId(lf);
      if (!id) return;
      const entry = calendarStatsMerged[id];
      if (!entry) return;
      return {
        likes: entry.likes,
        replies: entry.replies,
        mentions: entry.mentions,
        reposts: entry.reposts,
        zaps: entry.zaps,
        satszapped: entry.satszapped,
      };
    }
    const pd = calendarPostAsPostData(detailModalPost);
    const se = pd.signedEvent;
    if (
      !se ||
      typeof se !== "object" ||
      !("id" in se) ||
      typeof (se as { id: unknown }).id !== "string"
    ) {
      return;
    }
    const entry = calendarStatsMerged[(se as { id: string }).id];
    if (!entry) return;
    return {
      likes: entry.likes,
      replies: entry.replies,
      mentions: entry.mentions,
      reposts: entry.reposts,
      zaps: entry.zaps,
      satszapped: entry.satszapped,
    };
  }, [
    detailModalPost,
    detailModalType,
    detailModalPostIsLongform,
    calendarStatsMerged,
  ]);

  // Keyboard shortcuts: T = Today, Left/Right = prev/next period (ignore when modal open or focus in input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showRescheduleModal || isDetailModalOpen || showEditModal) return;
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
  }, [
    showRescheduleModal,
    isDetailModalOpen,
    showEditModal,
    currentDate,
    view,
    userTimezone,
  ]);

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

  const handleContentEditFromCalendar = useCallback(
    (cp: CalendarPost) => {
      const lf = getPostIsLongform(cp, isLongform, isAll);
      if (lf) {
        setPostToEdit(calendarPostAsLongFormEntity(cp));
        setShowEditModal(true);
        return;
      }
      const postData = calendarPostAsPostData(cp);
      const composeUrl =
        postData.dependencyMode === "attached"
          ? buildComposeEditUrl({
              mode: "edit_follow_up",
              followUpActionId: postData.id,
              ...(postData.parentScheduledActionId
                ? { parentActionId: postData.parentScheduledActionId }
                : {}),
            })
          : buildComposeEditUrl({
              mode: "edit_scheduled",
              scheduledActionId: postData.id,
            });
      navigate(composeUrl);
    },
    [isLongform, isAll, navigate]
  );

  const detailModalVm = useMemo(() => {
    if (!detailModalPost) return null;
    return scheduledPostViewModelFromCalendarPost(detailModalPost, {
      treatAsLongform: detailModalPostIsLongform,
    });
  }, [detailModalPost, detailModalPostIsLongform]);

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
      <CalendarToolbar
        view={view}
        onViewChange={(next) => {
          setSelectedPost(null);
          setView(next);
        }}
        currentDate={currentDate}
        onToday={() => {
          setSelectedPost(null);
          setCurrentDate(toDate(nowInTimezone(userTimezone)));
        }}
        onPrevious={() => {
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
        onNext={() => {
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
        userTimezone={userTimezone}
        dateLocale={dateLocale}
        miniCalendarOpen={miniCalendarOpen}
        onMiniCalendarOpenChange={(open) => {
          setMiniCalendarOpen(open);
          if (open) setMiniCalendarMonth(currentDate);
        }}
        miniCalendarMonth={miniCalendarMonth}
        onMiniCalendarMonthChange={setMiniCalendarMonth}
        onMiniCalendarSelectDate={(date) => {
          setSelectedPost(null);
          setCurrentDate(date);
          setMiniCalendarOpen(false);
        }}
        calendarPageTabs={calendarPageTabs}
        queueTypes={queueTypes}
      />

      {/* Calendar content: Day view on lg shows main + right sidebar */}
      <div className="flex min-h-0 flex-1 overflow-x-visible overflow-y-auto">
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
                  onEditPost={(p) => handleContentEditFromCalendar(p)}
                  onReschedulePost={(p) => handlePostEdit(p)}
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
        <RescheduleScheduledPostModal
          post={
            rescheduleData.isLongform
              ? calendarPostAsLongFormEntity(rescheduleData.post)
              : calendarPostAsPostData(rescheduleData.post)
          }
          user={user ?? undefined}
          queueTypes={queueTypes}
          initialDateTime={rescheduleData.newDateTime}
          wasAutoScheduled={rescheduleData.wasAutoScheduled}
          userTimeFormat={userTimeFormat}
          onClose={() => {
            setShowRescheduleModal(false);
            setRescheduleData(null);
          }}
          onSuccess={() => {
            setShowRescheduleModal(false);
            setRescheduleData(null);
            void queryClient.refetchQueries({ queryKey: calendarKeys.all });
            refreshPostViews();
          }}
        />
      ) : null}

      {showEditModal && postToEdit ? (
        <EditScheduledPostModal
          post={postToEdit}
          onClose={() => {
            setShowEditModal(false);
            setPostToEdit(null);
          }}
          onConfirm={() => {
            setShowEditModal(false);
            setPostToEdit(null);
            void queryClient.refetchQueries({ queryKey: calendarKeys.all });
            refreshPostViews();
          }}
          user={user ? (validateUserData(user) ?? undefined) : undefined}
          queueTypes={queueTypes ?? []}
          hashTagPresets={[]}
        />
      ) : null}

      {/* Details modal opened by clicking calendar blocks */}
      {detailModalPost && !detailModalPostIsLongform ? (
        <PostDetailsModal
          post={
            detailModalPost as Parameters<typeof PostDetailsModal>[0]["post"]
          }
          stats={detailModalPublishedStats}
          onClose={() => setDetailModalPost(null)}
          onDeleted={() => {
            setDetailModalPost(null);
            setCalendarLiveMessage("Post deleted");
            refreshPostViews();
          }}
          onEdit={(post) => {
            setDetailModalPost(null);
            handleContentEditFromCalendar(post as CalendarPost);
          }}
          onReschedule={(post) => {
            setDetailModalPost(null);
            handlePostEdit(post as CalendarPost);
          }}
          scheduledCapabilities={detailModalVm?.capabilities}
          showStats={detailModalType === "published"}
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
          stats={detailModalPublishedStats}
          onClose={() => setDetailModalPost(null)}
          onDeleted={() => {
            setDetailModalPost(null);
            setCalendarLiveMessage("Article deleted");
            refreshPostViews();
          }}
          onEdit={(post) => {
            setDetailModalPost(null);
            handleContentEditFromCalendar(post as unknown as CalendarPost);
          }}
          onReschedule={(post) => {
            setDetailModalPost(null);
            handlePostEdit(post as unknown as CalendarPost);
          }}
          type={detailModalType}
          showStats={detailModalType === "published"}
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
  dateLocale: "en-GB" | "en-US" | "en-CA";
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
          className="text-text-secondary hover:text-text rounded-[var(--calendar-radius-sm)] p-1"
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
          className="text-text-secondary hover:text-text rounded-[var(--calendar-radius-sm)] p-1"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={INLINE_ICON_STROKE} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {weekdays.map((d) => (
          <div
            key={d}
            className="text-text-secondary py-0.5 text-xs font-medium"
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
              !isCurrentMonth ? "text-text-secondary/70" : "text-text"
            } ${
              isSelected
                ? "bg-brand text-brand-on"
                : isToday
                  ? "ring-brand bg-brand/10 ring-1"
                  : "hover:bg-surface-hover"
            }`}
          >
            {date.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}
