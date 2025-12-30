import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useParams,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments";
import {
  Calendar,
  getQueueColor,
  handleCalendarAction,
  loadCalendarData,
  type PostData,
  type LongFormPostData,
  type QueueType,
  type UserData,
  convertJsonValueToScheduleConfig,
  mixedPostsToCalendarPosts,
  postsToCalendarPosts,
  longFormPostsToCalendarPosts,
} from "~/features/posts";
import { withErrorHandling, withActionErrorHandling } from "~/lib/error-handler.server";

async function loaderImpl({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to calendar feature
  await requireFeatureAccess(userId, 'calendar');

  const queueType = params.queueType ?? "all";

  return loadCalendarData(userId, queueType);
}

export const loader = withErrorHandling(loaderImpl);

export const action = withActionErrorHandling(async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  return handleCalendarAction(formData, userId);
});

type LoaderData = Awaited<ReturnType<typeof loaderImpl>>;

export default function CalendarRoute() {
  const data = useLoaderData<LoaderData>();
  const {
    scheduledPosts: scheduledPostsRaw,
    scheduledLongFormPosts: scheduledLongFormPostsRaw,
    pastPosts: pastPostsRaw,
    pastLongFormPosts: pastLongFormPostsRaw,
    allContent,
    user: userRaw,
    queueTypes: queueTypesRaw,
    selectedQueueType: _selectedQueueType,
  } = data;

  // Type assertions for Remix JsonifyObject serialization
  // Remix serializes Date objects to strings, so we need to assert these types
   
  const scheduledPosts: PostData[] = Array.isArray(scheduledPostsRaw) ? (scheduledPostsRaw as unknown as PostData[]) : [];
   
  const scheduledLongFormPosts: LongFormPostData[] = Array.isArray(scheduledLongFormPostsRaw) ? (scheduledLongFormPostsRaw as unknown as LongFormPostData[]) : [];
   
  const pastPosts: PostData[] = Array.isArray(pastPostsRaw) ? (pastPostsRaw as unknown as PostData[]) : [];
   
  const pastLongFormPosts: LongFormPostData[] = Array.isArray(pastLongFormPostsRaw) ? (pastLongFormPostsRaw as unknown as LongFormPostData[]) : [];
   
  const user: UserData | null | undefined = userRaw ? (userRaw as unknown as UserData) : null;
  const queueTypes: QueueType[] = Array.isArray(queueTypesRaw) ? queueTypesRaw.map((qt: unknown) => {
    if (qt && typeof qt === "object" && "id" in qt && "name" in qt) {
      const q = qt as { id: string; name: string; color?: string | null; scheduleType?: string; scheduleConfig?: unknown; isEnabled?: boolean; userId?: string };
      const result: QueueType = {
        id: q.id,
        name: q.name,
        color: q.color,
        description: undefined,
        scheduleType: q.scheduleType as "INTERVAL" | "FIXED_SLOTS" | undefined,
        scheduleConfig: convertJsonValueToScheduleConfig(q.scheduleConfig),
        isEnabled: q.isEnabled,
        userId: q.userId,
      };
      return result;
    }
    return null;
  }).filter((qt): qt is QueueType => qt !== null) : [];
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
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${currentTab === "all"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
          >
            All ({allContent.length})
          </Link>
          <Link
            to={`/dashboard/calendar${params.queueType ? `/${params.queueType}` : ""}?tab=posts`}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${currentTab === "posts"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
          >
            Posts ({scheduledPosts.length})
          </Link>
          <Link
            to={`/dashboard/calendar${params.queueType ? `/${params.queueType}` : ""}?tab=longform`}
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${currentTab === "longform"
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
              className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium ${!params.queueType
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
            >
              All Queues
            </Link>
            {queueTypes.map((queueType: string | { name: string; id?: string; color?: string | null }) => {
              const queueName =
                typeof queueType === "string" ? queueType : queueType.name;
              const queueColor =
                typeof queueType === "object" ? queueType.color : null;
              const colors = getQueueColor(queueName, queueColor);
              const isSelected = params.queueType === queueName;
              const queueId = typeof queueType === "object" && queueType.id ? queueType.id : queueName;

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
                  onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
                  className={`${baseClasses} ${isSelected
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
      ) : null}

      {/* Content based on current tab */}
      <div className="flex-1 min-h-0">
        {currentTab === "all" ? (
          <Calendar
            scheduledPosts={mixedPostsToCalendarPosts(scheduledPosts, scheduledLongFormPosts)}
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
            scheduledPosts={longFormPostsToCalendarPosts(scheduledLongFormPosts)}
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
