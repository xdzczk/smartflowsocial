import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useParams,
  useRevalidator,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { Calendar } from "~/features/posts/components/Calendar/Calendar";
import { getQueueColor } from "~/features/posts/queueColors";
import { postsToCalendarPosts } from "~/features/posts/utils/calendar-post-converter";
import { loadCalendarQueueData } from "~/features/posts/services/calendar-loader.server";
import { handleCalendarAction } from "~/features/posts/services/calendar-action.server";
import { withErrorHandling, withActionErrorHandling } from "~/lib/error-handler.server";

export const loader = withErrorHandling(async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const queueType = params.queueType || "all";

  return loadCalendarQueueData(userId, queueType);
});

export const action = withActionErrorHandling(async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  return handleCalendarAction(formData, userId);
});

export default function CalendarQueueRoute() {
  const {
    scheduledPosts,
    user,
    scheduleIntervals,
    queueTypes,
    selectedQueueType,
  } = useLoaderData<typeof loader>();
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
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
              !params.queueType
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            All Queues
          </Link>
          {queueTypes.map((queueType) => {
            const queueName =
              typeof queueType === "string" ? queueType : queueType.name;
            const queueColor =
              typeof queueType === "object" ? queueType.color : null;
            const colors = getQueueColor(queueName, queueColor);
            const isSelected = params.queueType === queueName;

            const baseClasses =
              "whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium capitalize";
            const unselectedClasses =
              "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300";

            if (isSelected && queueColor) {
              // Use inline styles for custom colors
              return (
                <Link
                  key={queueType.id}
                  to={`/dashboard/calendar/${queueName}`}
                  prefetch="intent"
                  onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
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
                key={queueType.id}
                to={`/dashboard/calendar/${queueName}`}
                prefetch="intent"
                onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
                className={`${baseClasses} ${
                  isSelected
                    ? `border-blue-500 ${colors.text}`
                    : unselectedClasses
                }`}
              >
                {queueName}
              </Link>
            );
          })}
        </nav>
      </div>

      <Calendar
        scheduledPosts={postsToCalendarPosts(scheduledPosts)}
        user={user}
        queueTypes={queueTypes}
      />
    </div>
  );
}
