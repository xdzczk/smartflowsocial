import {
  Link,
  useParams,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";

import {
  longFormPostsToCalendarPosts,
  mixedPostsToCalendarPosts,
  postsToCalendarPosts,
} from "~/features/posts/server";
import { Calendar, getQueueColor, useCalendarData } from "~/features/posts/ui";

export default function CalendarPage() {
  // Use TanStack Query for data fetching with caching
  const {
    scheduledPosts,
    scheduledLongFormPosts,
    pastPosts,
    pastLongFormPosts,
    allContent: _allContent,
    user,
    queueTypes,
    selectedQueueType: _selectedQueueType,
    isLoading: _isDataLoading,
    totalPostsCount,
    totalLongformCount,
    totalContentCount,
  } = useCalendarData();
  const params = useParams();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();

  // Get current tab from URL params - default to "all"
  const TAB_ALL = "all";
  const TAB_POSTS = "posts";
  const TAB_LONGFORM = "longform";
  const currentTab = searchParams.get("tab") ?? TAB_ALL;

  // Tab styling constants
  const TAB_ACTIVE_CLASSES = "border-blue-500 text-blue-600 dark:text-blue-400";
  const TAB_INACTIVE_CLASSES =
    "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300";

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
            to={`/dashboard/calendar${params["queueType"] ? `/${params["queueType"]}` : ""}?tab=${TAB_ALL}`}
            className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
              currentTab === TAB_ALL ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES
            }`}
          >
            All ({totalContentCount})
          </Link>
          <Link
            to={`/dashboard/calendar${params["queueType"] ? `/${params["queueType"]}` : ""}?tab=${TAB_POSTS}`}
            className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
              currentTab === TAB_POSTS
                ? TAB_ACTIVE_CLASSES
                : TAB_INACTIVE_CLASSES
            }`}
          >
            Posts ({totalPostsCount})
          </Link>
          <Link
            to={`/dashboard/calendar${params["queueType"] ? `/${params["queueType"]}` : ""}?tab=${TAB_LONGFORM}`}
            className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
              currentTab === TAB_LONGFORM
                ? TAB_ACTIVE_CLASSES
                : TAB_INACTIVE_CLASSES
            }`}
          >
            Longform ({totalLongformCount})
          </Link>
        </nav>
      </div>

      {/* Queue Selection Tabs - Show for all content types */}
      {currentTab === TAB_ALL ||
      currentTab === TAB_POSTS ||
      currentTab === TAB_LONGFORM ? (
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Queue Types">
            <Link
              to={`/dashboard/calendar?tab=${currentTab}`}
              prefetch="intent"
              onClick={() => setTimeout(() => revalidator.revalidate(), 0)}
              className={`border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
                !params["queueType"] ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES
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
      ) : null}

      {/* Content based on current tab */}
      <div className="min-h-0 flex-1">
        {currentTab === TAB_ALL ? (
          <Calendar
            scheduledPosts={mixedPostsToCalendarPosts(
              scheduledPosts,
              scheduledLongFormPosts
            )}
            pastPosts={mixedPostsToCalendarPosts(pastPosts, pastLongFormPosts)}
            user={user}
            queueTypes={queueTypes}
            isAll={true}
          />
        ) : currentTab === TAB_POSTS ? (
          <Calendar
            scheduledPosts={postsToCalendarPosts(scheduledPosts)}
            pastPosts={postsToCalendarPosts(pastPosts)}
            user={user}
            queueTypes={queueTypes}
          />
        ) : (
          <Calendar
            scheduledPosts={longFormPostsToCalendarPosts(
              scheduledLongFormPosts
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
