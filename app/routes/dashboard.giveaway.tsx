import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useParams } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  GiveawayFilters,
  GiveawayQueueTabs,
  GiveawayRandomizer,
  GiveawayTable,
  loadGiveawayData,
  useGiveawayState,
} from "~/features/giveaway";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { PostDetailsModal, type PostData } from "~/features/posts";
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to giveaway feature
    await requireFeatureAccess(userId, "giveaways");

    const url = new URL(request.url);
    const queueType = params.queueType ?? "all";
    const days = parseInt(url.searchParams.get("days") ?? "7");

    const data = await loadGiveawayData(userId, queueType, days);
    return data;
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

type LoaderData = Exclude<Awaited<ReturnType<typeof loader>>, Response>;

export default function PostedPosts() {
  const data = useLoaderData<LoaderData>();
  const { posts, stats, relatedEvents, user, queueTypes } = data;
  const params = useParams();

  const {
    sortConfig,
    searchTerm,
    selectedPost,
    dateRange,
    filteredPosts,
    requestSort,
    setSearchTerm,
    setSelectedPost,
    setDateRange,
    clearFilters,
  } = useGiveawayState({
    posts: posts.map((post: (typeof posts)[0]) => ({
      ...post,
      postedAt: (() => {
        const postedAtValue: unknown = post.postedAt;
        if (postedAtValue === null || postedAtValue === undefined) return null;
        if (postedAtValue instanceof Date) return postedAtValue;
        if (typeof postedAtValue === "string") return new Date(postedAtValue);
        return null;
      })(),
      totalEngagement:
        typeof post.totalEngagement === "number" ? post.totalEngagement : 0,
    })),
  });

  return (
    <div>
      <GiveawayRandomizer relatedEvents={relatedEvents} />

      <GiveawayFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onClearFilters={clearFilters}
      />

      <GiveawayQueueTabs
        queueTypes={queueTypes}
        currentQueueType={params.queueType}
      />

      <GiveawayTable
        posts={
          filteredPosts as unknown as Parameters<
            typeof GiveawayTable
          >[0]["posts"]
        }
        sortConfig={sortConfig}
        onRequestSort={requestSort}
        onPostClick={(post) => {
          // Find the original PostData from posts array
          const originalPostData = posts.find(
            (p: (typeof posts)[0]) => p.id === post.id,
          );
          if (originalPostData) {
            // Convert to the Post format expected by useGiveawayState
            setSelectedPost({
              ...originalPostData,
              postedAt: (() => {
                const postedAtValue: unknown = originalPostData.postedAt;
                if (postedAtValue === null || postedAtValue === undefined)
                  return null;
                if (postedAtValue instanceof Date) return postedAtValue;
                if (typeof postedAtValue === "string")
                  return new Date(postedAtValue);
                return null;
              })(),
              totalEngagement:
                typeof originalPostData.totalEngagement === "number"
                  ? originalPostData.totalEngagement
                  : 0,
            });
          }
        }}
      />

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost as unknown as PostData}
          stats={
            selectedPost &&
            typeof selectedPost === "object" &&
            "signedEvent" in selectedPost &&
            selectedPost.signedEvent &&
            typeof selectedPost.signedEvent === "object" &&
            "id" in selectedPost.signedEvent &&
            typeof selectedPost.signedEvent.id === "string" &&
            stats &&
            typeof stats === "object" &&
            !Array.isArray(stats)
              ? stats[selectedPost.signedEvent.id]
              : undefined
          }
          onClose={() => setSelectedPost(null)}
          showStats={true}
          showSignedEvent={true}
          type="posted"
          userTimezone={user?.timezone ?? undefined}
        />
      ) : null}
    </div>
  );
}
