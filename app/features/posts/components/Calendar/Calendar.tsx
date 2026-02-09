import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useCallback } from "react";

import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import {
  addDays,
  addMonths,
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
  const [view, setView] = useState<"week" | "month">("week");
  const userTimezone = user?.timezone ?? "Etc/UTC";
  const [currentDate, setCurrentDate] = useState(() => {
    const now = nowInTimezone(userTimezone);
    return toDate(now);
  });
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<RescheduleData | null>(
    null
  );

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
    <div className="border-border bg-card flex h-full flex-col rounded-lg border shadow">
      {/* Header with view toggle */}
      <div className="border-border border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Navigation */}
            <button
              onClick={() => {
                const currentZoned = fromDate(currentDate, userTimezone);
                const newZoned =
                  view === "week"
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

            <h2 className="text-foreground text-lg font-semibold">
              {(() => {
                const currentZoned = fromDate(currentDate, userTimezone);
                return view === "week"
                  ? `Week of ${formatForDisplay(currentZoned, userTimezone, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`
                  : formatForDisplay(currentZoned, userTimezone, {
                      month: "long",
                      year: "numeric",
                    });
              })()}
            </h2>

            <button
              onClick={() => {
                const currentZoned = fromDate(currentDate, userTimezone);
                const newZoned =
                  view === "week"
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
            >
              Today
            </button>
          </div>

          {/* View toggle */}
          <div className="bg-secondary/30 flex items-center space-x-1 rounded-lg p-1">
            <button
              onClick={() => setView("week")}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                view === "week"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("month")}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                view === "month"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Calendar content */}
      <div className="min-h-0 flex-1 overflow-hidden p-4">
        {view === "week" ? (
          <WeeklyView
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
