import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
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

import { MonthlyView } from "./MonthlyView";
import type { CalendarPost } from "./PostBlock.types";
import { RescheduleModal } from "./RescheduleModal";
import { WeeklyView } from "./WeeklyView";

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
}

export function Calendar({
  scheduledPosts,
  pastPosts = [],
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
}: CalendarProps) {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const userTimezone = user?.timezone ?? "Etc/UTC";
  const [currentDate, setCurrentDate] = useState(() => {
    const now = nowInTimezone(userTimezone);
    return toDate(now);
  });
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<RescheduleData | null>(
    null
  );
  const [miniCalendarOpen, setMiniCalendarOpen] = useState(false);
  const [miniCalendarMonth, setMiniCalendarMonth] = useState<Date>(() => {
    const now = nowInTimezone(user?.timezone ?? "Etc/UTC");
    return toDate(now);
  });

  const handlePostDrop = useCallback(
    (post: CalendarPost, newDateTime: Date) => {
      // Determine if this specific post is a longform post
      const postIsLongform = isAll
        ? Boolean(post.title && post.publishedAt)
        : isLongform;
      const wasAutoScheduled = postIsLongform ? false : !post.manual_override;

      setRescheduleData({
        post,
        newDateTime,
        wasAutoScheduled,
        queueName: postIsLongform ? null : (post.queueType?.name ?? null),
        isEdit: false,
        isLongform: postIsLongform,
      });
      setShowRescheduleModal(true);
    },
    [isLongform, isAll]
  );

  // Keyboard shortcuts: T = Today, Left/Right = prev/next period (ignore when modal open or focus in input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showRescheduleModal) return;
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
        setCurrentDate(toDate(newZoned));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showRescheduleModal, currentDate, view, userTimezone]);

  const handlePostEdit = useCallback(
    (post: CalendarPost) => {
      // Determine if this specific post is a longform post
      const postIsLongform = isAll
        ? Boolean(post.title && post.publishedAt)
        : isLongform;
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
    },
    [isLongform, isAll]
  );

  return (
    <div
      className="flex h-full flex-col rounded-[var(--calendar-radius-lg)] border border-[hsl(var(--calendar-surface-2-border))] bg-[hsl(var(--calendar-surface-2-bg))]"
      style={{ boxShadow: "var(--calendar-surface-2-shadow)" }}
    >
      {/* Header with view toggle */}
      <div className="border-border/60 border-b bg-[hsl(var(--calendar-surface-1-bg))] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Navigation */}
            <button
              onClick={() => {
                const currentZoned = fromDate(currentDate, userTimezone);
                const newZoned =
                  view === "day"
                    ? addDays(currentZoned, -1)
                    : view === "week"
                      ? addDays(currentZoned, -7)
                      : addMonths(currentZoned, -1);
                setCurrentDate(toDate(newZoned));
              }}
              className="text-muted-foreground hover:text-foreground p-2"
              aria-label="Previous"
            >
              <ChevronLeft
                className="h-5 w-5"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </button>

            <h2 className="text-foreground text-lg font-medium">
              {(() => {
                const currentZoned = fromDate(currentDate, userTimezone);
                if (view === "day") {
                  return `Day of ${formatForDisplay(
                    currentZoned,
                    userTimezone,
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}`;
                }
                if (view === "week") {
                  return `Week of ${formatForDisplay(
                    currentZoned,
                    userTimezone,
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}`;
                }
                return formatForDisplay(currentZoned, userTimezone, {
                  month: "long",
                  year: "numeric",
                });
              })()}
            </h2>

            <button
              onClick={() => {
                const currentZoned = fromDate(currentDate, userTimezone);
                const newZoned =
                  view === "day"
                    ? addDays(currentZoned, 1)
                    : view === "week"
                      ? addDays(currentZoned, 7)
                      : addMonths(currentZoned, 1);
                setCurrentDate(toDate(newZoned));
              }}
              className="text-muted-foreground hover:text-foreground p-2"
              aria-label="Next"
            >
              <ChevronRight
                className="h-5 w-5"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </button>

            <button
              onClick={() => {
                const now = nowInTimezone(userTimezone);
                setCurrentDate(toDate(now));
              }}
              className="text-primary hover:text-primary/80 px-3 py-1 text-sm"
              title="Today (T)"
            >
              Today
            </button>

            {/* Mini calendar / date picker: only in Day view (Apple Calendar–style) */}
            {view === "day" ? (
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
                    className="text-muted-foreground hover:text-foreground rounded-[var(--calendar-radius-sm)] p-2"
                    aria-label="Pick a date"
                  >
                    <CalendarDays
                      className="h-5 w-5"
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
                    onMonthChange={setMiniCalendarMonth}
                    onSelectDate={(date) => {
                      setCurrentDate(date);
                      setMiniCalendarOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            ) : null}
          </div>

          {/* View toggle: Day | Week | Month (calendar radius sm, surface tokens) */}
          <div className="bg-muted/50 flex items-center space-x-1 rounded-[var(--calendar-radius-sm)] p-1">
            {(["day", "week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-[var(--calendar-radius-sm)] px-3 py-1 text-sm font-medium ${
                  view === v
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <div
          className="flex min-h-0 flex-1 flex-col transition-opacity duration-200"
          style={{
            transitionTimingFunction: "var(--calendar-transition-ease)",
          }}
        >
          {view === "day" || view === "week" ? (
            <WeeklyView
              scheduledPosts={scheduledPosts}
              pastPosts={pastPosts}
              currentDate={currentDate}
              weekDaysOverride={view === "day" ? [currentDate] : undefined}
              onPostDrop={handlePostDrop}
              onPostEdit={handlePostEdit}
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
              onPostEdit={handlePostEdit}
              user={user}
              queueTypes={queueTypes}
              isLongform={isLongform}
              isAll={isAll}
            />
          )}
        </div>
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
            // Optionally refresh the page or update state
            window.location.reload();
          }}
        />
      ) : null}
    </div>
  );
}

interface MiniCalendarGridProps {
  displayedMonth: Date;
  currentDate: Date;
  userTimezone: string;
  onMonthChange: (date: Date) => void;
  onSelectDate: (date: Date) => void;
}

function MiniCalendarGrid({
  displayedMonth,
  currentDate: _currentDate,
  userTimezone,
  onMonthChange,
  onSelectDate,
}: MiniCalendarGridProps) {
  const currentZoned = fromDate(displayedMonth, "UTC");
  const year = currentZoned.year;
  const month = currentZoned.month;
  const firstDayZoned = createZonedDateTime(year, month, 1, 0, 0, "UTC");
  const dayOfWeek = firstDayZoned.dayOfWeek;
  const daysFromMonday = dayOfWeek === 7 ? 6 : dayOfWeek - 1;
  const startDateZoned = addDays(firstDayZoned, -daysFromMonday);
  const todayZoned = nowInTimezone(userTimezone);

  const days = useMemo(() => {
    const out: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];
    for (let i = 0; i < 42; i++) {
      const dateZoned = addDays(startDateZoned, i);
      out.push({
        date: toDate(dateZoned),
        isCurrentMonth: dateZoned.month === month,
        isToday:
          dateZoned.year === todayZoned.year &&
          dateZoned.month === todayZoned.month &&
          dateZoned.day === todayZoned.day,
      });
    }
    return out;
    // Intentionally depend only on displayedMonth and userTimezone; month/startDateZoned/todayZoned are derived
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid recomputing every render from todayZoned
  }, [displayedMonth, userTimezone]);

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
          {formatForDisplay(fromDate(displayedMonth, "UTC"), userTimezone, {
            month: "long",
            year: "numeric",
          })}
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
        {days.map(({ date, isCurrentMonth, isToday }) => (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onSelectDate(date)}
            className={`min-w-[28px] rounded-[var(--calendar-radius-sm)] py-1 text-xs ${
              !isCurrentMonth ? "text-muted-foreground/70" : "text-foreground"
            } ${isToday ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {date.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
}
