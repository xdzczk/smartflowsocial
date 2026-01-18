import { Link, useParams, useRevalidator } from "@remix-run/react";

import { postsToCalendarPosts } from "~/features/posts/server";
import {
  Calendar,
  getQueueColor,
  useCalendarQueueData,
} from "~/features/posts/ui";
import { validateUserData } from "~/lib/validation/user-data";

export default function CalendarQueuePage() {
  // Use TanStack Query for data fetching with caching
  const {
    scheduledPosts,
    user,
    scheduleIntervals: _scheduleIntervals,
    queueTypes,
    selectedQueueType,
  } = useCalendarQueueData();
  const params = useParams();
  const revalidator = useRevalidator();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Calendar -{" "}
          {selectedQueueType === "all"
            ? "All Queues"
            : selectedQueueType.charAt(0).toUpperCase() +
              selectedQueueType.slice(1)}
        </h1>
      </div>

      {/* Queue Selection Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Queue Types">
          <Link
            to="/dashboard/calendar"
            prefetch="intent"
            onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
            className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
              !params["queueType"]
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            All Queues
          </Link>
          {queueTypes.map(
            (
              queueType:
                | string
                | { name: string; id?: string; color?: string | null }
            ) => {
              const queueName =
                typeof queueType === "string" ? queueType : queueType.name;
              const queueColor =
                typeof queueType === "object" ? queueType.color : null;
              const colors = getQueueColor(queueName, queueColor);
              const safeColors = colors ?? getQueueColor("unassigned");
              const isSelected = params["queueType"] === queueName;
              const queueId =
                typeof queueType === "object" && queueType.id
                  ? queueType.id
                  : queueName;

              const baseClasses =
                "whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium capitalize";
              const unselectedClasses =
                "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300";

              if (isSelected && queueColor) {
                // Use inline styles for custom colors
                return (
                  <Link
                    key={queueId}
                    to={`/dashboard/calendar/${queueName}`}
                    prefetch="intent"
                    onClick={() =>
                      setTimeout(() => revalidator.revalidate(), 0)
                    }
                    className={`${baseClasses} border-b-2`}
                    style={{
                      borderBottomColor: queueColor,
                      color: queueColor,
                    }}
                  >
                    {queueName}
                  </Link>
                );
              }

              return (
                <Link
                  key={queueId}
                  to={`/dashboard/calendar/${queueName}`}
                  prefetch="intent"
                  onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
                  className={`${baseClasses} ${
                    isSelected
                      ? `border-blue-500 ${safeColors?.text ?? ""}`
                      : unselectedClasses
                  }`}
                >
                  {queueName}
                </Link>
              );
            }
          )}
        </nav>
      </div>

      <Calendar
        scheduledPosts={postsToCalendarPosts(scheduledPosts)}
        user={user ? (validateUserData(user) ?? undefined) : undefined}
        queueTypes={queueTypes}
      />
    </div>
  );
}
