import { useSearchParams } from "@remix-run/react";

import {
  longFormPostsToCalendarPosts,
  mixedPostsToCalendarPosts,
  postsToCalendarPosts,
} from "~/features/posts/server";
import {
  Calendar,
  ContentListPageHeader,
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
  const CALENDAR_BASE_PATH = "/dashboard/calendar";
  const currentTab = searchParams.get("tab") ?? TAB_ALL;

  return (
    <div className="flex h-full min-h-0 flex-col space-y-2">
      <ContentListPageHeader pageType="calendar" currentTab={currentTab} />

      {/* Content based on current tab; content-type and queue tabs are inside Calendar header */}
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
            calendarPageTabs={{
              currentTab,
              basePath: CALENDAR_BASE_PATH,
              totalContentCount,
              totalPostsCount,
              totalRepostsCount,
              totalLongformCount,
            }}
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
            calendarPageTabs={{
              currentTab,
              basePath: CALENDAR_BASE_PATH,
              totalContentCount,
              totalPostsCount,
              totalRepostsCount,
              totalLongformCount,
            }}
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
            calendarPageTabs={{
              currentTab,
              basePath: CALENDAR_BASE_PATH,
              totalContentCount,
              totalPostsCount,
              totalRepostsCount,
              totalLongformCount,
            }}
          />
        ) : currentTab === TAB_LONGFORM ? (
          <Calendar
            scheduledPosts={longFormPostsToCalendarPosts(
              scheduledLongFormPosts
            )}
            pastPosts={longFormPostsToCalendarPosts(pastLongFormPosts)}
            user={user}
            queueTypes={queueTypes}
            isLongform={true}
            calendarPageTabs={{
              currentTab,
              basePath: CALENDAR_BASE_PATH,
              totalContentCount,
              totalPostsCount,
              totalRepostsCount,
              totalLongformCount,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
