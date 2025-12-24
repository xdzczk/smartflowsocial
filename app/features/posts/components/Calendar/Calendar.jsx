import { useState, useCallback } from "react";
import { WeeklyView } from "./WeeklyView";
import { MonthlyView } from "./MonthlyView";
import { RescheduleModal } from "./RescheduleModal";

export function Calendar({
  scheduledPosts,
  pastPosts = [],
  user,
  queueTypes,
  isLongform = false,
  isAll = false,
}) {
  const [view, setView] = useState("week"); // 'week' or 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState(null);

  const handlePostDrop = useCallback(
    (post, newDateTime) => {
      // Determine if this specific post is a longform post
      const postIsLongform = isAll ? !!post.title && post.publishedAt : isLongform;
      const wasAutoScheduled = postIsLongform ? false : !post.manual_override;

      setRescheduleData({
        post,
        newDateTime,
        wasAutoScheduled,
        queueName: postIsLongform ? null : post.queueType?.name || null,
        isEdit: false,
        isLongform: postIsLongform,
      });
      setShowRescheduleModal(true);
    },
    [isLongform, isAll],
  );

  const handlePostEdit = useCallback(
    (post) => {
      // Determine if this specific post is a longform post
      const postIsLongform = isAll ? !!post.title && post.publishedAt : isLongform;
      const wasAutoScheduled = postIsLongform ? false : !post.manual_override;
      // For longform posts, use publishedAt instead of scheduledFor
      const currentDateTime = postIsLongform
        ? new Date(post.publishedAt)
        : new Date(Number(post.scheduledFor) * 1000);

      setRescheduleData({
        post,
        newDateTime: currentDateTime,
        wasAutoScheduled,
        queueName: postIsLongform ? null : post.queueType?.name || null,
        isEdit: true,
        isLongform: postIsLongform,
      });
      setShowRescheduleModal(true);
    },
    [isLongform, isAll],
  );

  return (
    <div className="flex h-full flex-col rounded-lg bg-white shadow dark:bg-gray-800">
      {/* Header with view toggle */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Navigation */}
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                if (view === "week") {
                  newDate.setDate(newDate.getDate() - 7);
                } else {
                  newDate.setMonth(newDate.getMonth() - 1);
                }
                setCurrentDate(newDate);
              }}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {view === "week"
                ? `Week of ${currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: user?.timezone || "Etc/UTC" })}`
                : currentDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                    timeZone: user?.timezone || "Etc/UTC",
                  })}
            </h2>

            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                if (view === "week") {
                  newDate.setDate(newDate.getDate() + 7);
                } else {
                  newDate.setMonth(newDate.getMonth() + 1);
                }
                setCurrentDate(newDate);
              }}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Today
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center space-x-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
            <button
              onClick={() => setView("week")}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                view === "week"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("month")}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                view === "month"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Calendar content */}
      <div className="flex-1 min-h-0 overflow-hidden p-4">
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
