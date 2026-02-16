import { useSearchParams } from "@remix-run/react";

import {
  longFormPostsToCalendarPosts,
  mixedPostsToCalendarPosts,
  postsToCalendarPosts,
} from "~/features/posts/server";
import {
  Calendar,
  ContentListPageHeader,
  PostTypeTabs,
  QueueSelectionTabs,
  useCalendarData,
} from "~/features/posts/ui";
import { isRepostPost } from "~/features/posts/utils/content-helpers";

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
    totalRepostsCount,
    totalLongformCount,
    totalContentCount,
  } = useCalendarData();
  const [searchParams] = useSearchParams();

  // Get current tab from URL params - default to "all"
  const TAB_ALL = "all";
  const TAB_POSTS = "posts";
  const TAB_REPOSTS = "reposts";
  const TAB_LONGFORM = "longform";
  const currentTab = searchParams.get("tab") ?? TAB_ALL;

  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <ContentListPageHeader pageType="calendar" currentTab={currentTab} />

      <div className="border-border/50 mb-4 flex flex-row flex-nowrap items-end gap-2 border-b">
        <PostTypeTabs
          currentTab={currentTab}
          basePath="/dashboard/calendar"
          totalContentCount={totalContentCount}
          totalPostsCount={totalPostsCount}
          totalRepostsCount={totalRepostsCount}
          totalLongformCount={totalLongformCount}
          inRow
        />
        {currentTab === TAB_ALL ||
        currentTab === TAB_POSTS ||
        currentTab === TAB_REPOSTS ||
        currentTab === TAB_LONGFORM ? (
          <QueueSelectionTabs
            currentTab={currentTab}
            queueTypes={queueTypes}
            basePath="/dashboard/calendar"
          />
        ) : null}
      </div>

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
            scheduledPosts={postsToCalendarPosts(
              scheduledPosts.filter((p) => !isRepostPost(p))
            )}
            pastPosts={postsToCalendarPosts(
              pastPosts.filter((p) => !isRepostPost(p))
            )}
            user={user}
            queueTypes={queueTypes}
          />
        ) : currentTab === TAB_REPOSTS ? (
          <Calendar
            scheduledPosts={postsToCalendarPosts(
              scheduledPosts.filter((p) => isRepostPost(p))
            )}
            pastPosts={postsToCalendarPosts(
              pastPosts.filter((p) => isRepostPost(p))
            )}
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
