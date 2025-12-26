import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useParams,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import { combineContent } from "~/features/posts/combined.server";
import { Calendar } from "~/features/posts/components/Calendar/Calendar";
import { getQueueColor } from "~/features/posts/queueColors";
import { filterPostsArraysByQueueType } from "~/features/posts/services/post-filtering.server";
import { mixedPostsToCalendarPosts, postsToCalendarPosts, longFormPostsToCalendarPosts } from "~/features/posts/utils/calendar-post-converter";
import {
  cancelPostJob as cancelScheduledPost,
  enqueuePostJob as schedulePost,
} from "~/infra/queue";
import {
  getScheduledLongFormPosts,
  updateLongFormPost,
  getLongFormPost,
  getPastLongFormPosts,
} from "~/models/longformpost.server";
import {
  getScheduledPosts,
  reschedulePost,
  getPostById,
  getPastPosts,
} from "~/models/post.server";
import { getUserById, getQueueTypes } from "~/models/user.server";
import { withErrorHandling, withActionErrorHandling } from "~/lib/error-handler.server";

export const loader = withErrorHandling(async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to calendar feature
  await requireFeatureAccess(userId, 'calendar');

  const queueType = params.queueType || "all";

  // Calculate date range for past posts (90 days back for better history)
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    allScheduledPosts,
    allScheduledLongFormPosts,
    allPastPosts,
    allPastLongFormPosts,
    user,
    queueTypes,
  ] = await Promise.all([
    getScheduledPosts({ userId }),
    getScheduledLongFormPosts({ userId }),
    getPastPosts({ userId, startDate: ninetyDaysAgo, endDate: now }),
    getPastLongFormPosts({ userId, startDate: ninetyDaysAgo, endDate: now }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Filter posts by queue type if specific queue is selected
  const {
    scheduledPosts,
    scheduledLongFormPosts,
    pastPosts,
    pastLongFormPosts,
  } = filterPostsArraysByQueueType({
    scheduledPosts: allScheduledPosts,
    scheduledLongFormPosts: allScheduledLongFormPosts,
    pastPosts: allPastPosts,
    pastLongFormPosts: allPastLongFormPosts,
    queueType,
  });

  // Combine posts and longform posts for the "All" tab
  const allContent = combineContent(
    scheduledPosts,
    scheduledLongFormPosts,
    "scheduledFor",
    "asc",
  );
  const allPastContent = combineContent(
    pastPosts,
    pastLongFormPosts,
    "postedAt",
    "desc",
  );

  return {
    scheduledPosts,
    scheduledLongFormPosts,
    pastPosts,
    pastLongFormPosts,
    allContent,
    allPastContent,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    scheduleIntervals: user?.scheduleInterval || [],
  };
});

export const action = withActionErrorHandling(async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "reschedule") {
    const postId = formData.get("postId") as string | null;
    const newTime = formData.get("newTime") as string | null;
    const overrideQueue = formData.get("overrideQueue") === "true";
    const signedEvent = formData.get("signedEvent") as string | null;
    const nostrEvent = formData.get("nostrEvent") as string | null;
    const queueTypeId = formData.get("queueTypeId") as string | null;

    if (!postId || !newTime) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get the original post
    const originalPost = await getPostById({ id: postId, userId });
    if (!originalPost) {
      return json({ error: "Post not found" }, { status: 404 });
    }

    // Cancel existing scheduled job
    await cancelScheduledPost(postId);

    // Parse signed events if provided (from client-side re-signing)
    let parsedSignedEvent = null;
    let parsedNostrEvent = null;

    if (signedEvent && nostrEvent) {
      try {
        parsedSignedEvent = JSON.parse(signedEvent);
        parsedNostrEvent = JSON.parse(nostrEvent);
      } catch (e) {
        // Log parsing error but continue without signed events
        const { logWarning } = await import("~/lib/error-logger.server");
        logWarning("Failed to parse signed events in reschedule", {
          postId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Update post in database
    const updatedPost = await reschedulePost({
      id: postId,
      userId,
      newScheduledFor: newTime,
      overrideQueue,
    });

    // If we have a newly signed event, update the post with it and schedule the job
    if (parsedSignedEvent && parsedNostrEvent) {
      // Update post with new signed event
      const finalPost = await reschedulePost({
        id: postId,
        userId,
        newScheduledFor: newTime,
        overrideQueue,
        signedEvent: parsedSignedEvent,
        nostrEvent: parsedNostrEvent,
      });

      // Schedule new job
      await schedulePost(
        postId,
        userId,
        parsedSignedEvent,
        parseInt(newTime),
      );

      return json({ success: true, post: finalPost, signed: true });
    }

    // Return success but indicate signing is needed
    return json({ success: true, post: updatedPost, needsSigning: true });
  }

  if (actionType === "rescheduleLongform") {
    const postId = formData.get("postId") as string | null;
    const newTime = formData.get("newTime") as string | null;
    const signedEvent = formData.get("signedEvent") as string | null;
    const nostrEvent = formData.get("nostrEvent") as string | null;

    if (!postId || !newTime) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get the original longform post
    const originalPost = await getLongFormPost({ id: postId, userId });
    if (!originalPost) {
      return json({ error: "Longform post not found" }, { status: 404 });
    }

    // Parse signed events if provided (from client-side re-signing)
    let parsedSignedEvent = null;
    let parsedNostrEvent = null;

    if (signedEvent && nostrEvent) {
      try {
        parsedSignedEvent = JSON.parse(signedEvent);
        parsedNostrEvent = JSON.parse(nostrEvent);
      } catch (e) {
        // Log parsing error but continue without signed events
        const { logWarning } = await import("~/lib/error-logger.server");
        logWarning("Failed to parse signed events in reschedule", {
          postId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Update longform post in database
    const updatedPost = await updateLongFormPost({
      id: postId,
      userId,
      scheduledFor: newTime,
      signedEvent: parsedSignedEvent,
      nostrEvent: parsedNostrEvent,
    });

    return json({
      success: true,
      post: updatedPost,
      signed: !!parsedSignedEvent,
    });
  }

  return json({ error: "Invalid action" }, { status: 400 });
});

export default function CalendarRoute() {
  const {
    scheduledPosts,
    scheduledLongFormPosts,
    pastPosts,
    pastLongFormPosts,
    allContent,
    allPastContent,
    user,
    scheduleIntervals,
    queueTypes,
    selectedQueueType,
  } = useLoaderData<typeof loader>();
  const params = useParams();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") || "all";

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
                  key={queueType.id}
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
