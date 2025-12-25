import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useParams,
  useRevalidator,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { Calendar } from "~/features/posts/components/Calendar/Calendar";
import { getQueueColor } from "~/features/posts/queueColors";
import { filterPostsByQueueType } from "~/features/posts/services/post-filtering.server";
import {
  cancelPostJob as cancelScheduledPost,
  enqueuePostJob as schedulePost,
} from "~/infra/queue";
import {
  getScheduledPosts,
  reschedulePost,
  getPostById,
} from "~/models/post.server";
import { getUserById, getQueueTypes } from "~/models/user.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const queueType = params.queueType || "all";

  const [allScheduledPosts, user, queueTypes] = await Promise.all([
    getScheduledPosts({ userId }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Filter posts by queue type if specific queue is selected
  const scheduledPosts = filterPostsByQueueType(allScheduledPosts, queueType);

  return json({
    scheduledPosts,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
    scheduleIntervals: user?.scheduleInterval || [],
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "reschedule") {
    try {
      const postId = formData.get("postId") as string | null;
      const newTime = formData.get("newTime") as string | null;
      const overrideQueue = formData.get("overrideQueue") === "true";
      const signedEvent = formData.get("signedEvent") as string | null;
      const nostrEvent = formData.get("nostrEvent") as string | null;

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
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }

  return json({ error: "Invalid action" }, { status: 400 });
}

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
        scheduledPosts={scheduledPosts as any}
        user={user}
        queueTypes={queueTypes}
      />
    </div>
  );
}
