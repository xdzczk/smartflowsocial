import { Link, useParams, useRevalidator } from "@remix-run/react";

import { Calendar, useCalendarQueueData } from "~/features/posts/calendar";
import { postsToCalendarPosts } from "~/features/posts/server/calendar";
import { getQueueAccentHex, getQueueColor } from "~/features/posts/ui";
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
        <h1 className="text-text text-2xl font-semibold">
          Calendar -{" "}
          {selectedQueueType === "all"
            ? "All Queues"
            : selectedQueueType.charAt(0).toUpperCase() +
              selectedQueueType.slice(1)}
        </h1>
      </div>

      {/* Queue Selection Tabs */}
      <div className="border-border dark:border-border border-b">
        <nav className="-mb-px flex space-x-8" aria-label="Queue Types">
          <Link
            to="/dashboard/calendar"
            prefetch="intent"
            onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
            className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
              !params["queueType"]
                ? "border-brand-strong text-text-secondary"
                : "text-text-secondary hover:border-border hover:text-text-secondary dark:text-text dark:hover:text-text border-transparent"
            }`}
          >
            All Queues
          </Link>
          {queueTypes.map(
            (
              queueType:
                | string
                | { name: string; id?: string; colorToken?: string | null }
            ) => {
              const queueName =
                typeof queueType === "string" ? queueType : queueType.name;
              const colorToken =
                typeof queueType === "object"
                  ? (queueType as { colorToken?: string | null }).colorToken
                  : null;
              const colors = getQueueColor(queueName, colorToken);
              const isSelected = params["queueType"] === queueName;
              const queueId =
                typeof queueType === "object" && queueType.id
                  ? queueType.id
                  : queueName;

              const baseClasses =
                "whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium capitalize";
              const unselectedClasses =
                "border-transparent text-text-secondary hover:border-border hover:text-text-secondary dark:text-text dark:hover:text-text";

              if (isSelected && colorToken) {
                const accentHex = getQueueAccentHex(colorToken);
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
                      borderBottomColor: accentHex,
                      color: accentHex,
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
                      ? `border-brand-strong ${colors.text}`
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
