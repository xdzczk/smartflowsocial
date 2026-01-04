import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import {
  Link,
  useParams,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  handleCalendarAction,
  loadCalendarData,
  mixedPostsToCalendarPosts,
  postsToCalendarPosts,
  longFormPostsToCalendarPosts,
} from "~/features/posts/server";
import {
  Calendar,
  getQueueColor,
  useCalendarData,
} from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { calendarLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to calendar feature
    await requireFeatureAccess(userId, "calendar");

    const queueType = params.queueType ?? "all";

    const data = await loadCalendarData(userId, queueType);
    
    // Validate loader response with Zod schema
    return validateLoaderResponse(data, calendarLoaderDataSchema);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}

export const action = withCSRFProtection(async ({ request }: ActionFunctionArgs) => {
  try {
    const userId = await requireUserId(request);
    const formData = await request.formData();
    return handleCalendarAction(formData, userId);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
});

type _LoaderData = Exclude<Awaited<ReturnType<typeof loader>>, Response>;

export default function CalendarRoute() {
  // Use TanStack Query for data fetching with caching
  const {
    scheduledPosts,
    scheduledLongFormPosts,
    pastPosts,
    pastLongFormPosts,
    allContent,
    user,
    queueTypes,
    selectedQueueType: _selectedQueueType,
    isLoading: _isDataLoading,
  } = useCalendarData();
  const params = useParams();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") ?? "all";

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Calendar
        </h1>
      </div>

      {/* Post Type Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Post Types">
          <Link
            to={`/dashboard/calendar${params.queueType ? `/${params.queueType}` : ""}?tab=all`}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
              currentTab === "all"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            All ({allContent.length})
          </Link>
          <Link
            to={`/dashboard/calendar${params.queueType ? `/${params.queueType}` : ""}?tab=posts`}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
              currentTab === "posts"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Posts ({scheduledPosts.length})
          </Link>
          <Link
            to={`/dashboard/calendar${params.queueType ? `/${params.queueType}` : ""}?tab=longform`}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${
              currentTab === "longform"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Longform ({scheduledLongFormPosts.length})
          </Link>
        </nav>
      </div>

      {/* Queue Selection Tabs - Show for all content types */}
      {currentTab === "all" ||
      currentTab === "posts" ||
      currentTab === "longform" ? (
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Queue Types">
            <Link
              to={`/dashboard/calendar?tab=${currentTab}`}
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
            {queueTypes.map(
              (
                queueType:
                  | string
                  | { name: string; id?: string; color?: string | null },
              ) => {
                const queueName =
                  typeof queueType === "string" ? queueType : queueType.name;
                const queueColor =
                  typeof queueType === "object" ? queueType.color : null;
                const colors = getQueueColor(queueName, queueColor);
                const isSelected = params.queueType === queueName;
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
                      to={`/dashboard/calendar/${queueName}?tab=${currentTab}`}
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
                    to={`/dashboard/calendar/${queueName}?tab=${currentTab}`}
                    prefetch="intent"
                    onClick={() =>
                      setTimeout(() => revalidator.revalidate(), 0)
                    }
                    className={`${baseClasses} ${
                      isSelected
                        ? `border-blue-500 ${colors.text}`
                        : unselectedClasses
                    }`}
                  >
                    {queueName}
                  </Link>
                );
              },
            )}
          </nav>
        </div>
      ) : null}

      {/* Content based on current tab */}
      <div className="min-h-0 flex-1">
        {currentTab === "all" ? (
          <Calendar
            scheduledPosts={mixedPostsToCalendarPosts(
              scheduledPosts,
              scheduledLongFormPosts,
            )}
            pastPosts={mixedPostsToCalendarPosts(pastPosts, pastLongFormPosts)}
            user={user}
            queueTypes={queueTypes}
            isAll={true}
          />
        ) : currentTab === "posts" ? (
          <Calendar
            scheduledPosts={postsToCalendarPosts(scheduledPosts)}
            pastPosts={postsToCalendarPosts(pastPosts)}
            user={user}
            queueTypes={queueTypes}
          />
        ) : (
          <Calendar
            scheduledPosts={longFormPostsToCalendarPosts(
              scheduledLongFormPosts,
            )}
            pastPosts={longFormPostsToCalendarPosts(pastLongFormPosts)}
            user={user}
            queueTypes={queueTypes}
            isLongform={true}
          />
        )}
      </div>
    </div>
  );
}
