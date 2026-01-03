import type { LoaderFunctionArgs } from "@remix-run/node";
import { useParams } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  GiveawayFilters,
  GiveawayQueueTabs,
  GiveawayRandomizer,
  GiveawayTable,
  loadGiveawayData,
  useGiveawayState,
  useGiveawayData,
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

type _LoaderData = Exclude<Awaited<ReturnType<typeof loader>>, Response>;

export default function PostedPosts() {
  // Use TanStack Query for data fetching with caching
  const {
    posts: typedPosts,
    stats: typedStats,
    relatedEvents,
    user,
    queueTypes,
  } = useGiveawayData();
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
    posts: typedPosts.map((post) => ({
      ...post,
      postedAt: post.postedAt instanceof Date ? post.postedAt : null,
      totalEngagement: post.totalEngagement ?? 0,
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
          const originalPostData = typedPosts.find((p) => p.id === post.id);
          if (originalPostData) {
            // Convert to the Post format expected by useGiveawayState
            setSelectedPost({
              ...originalPostData,
              postedAt: originalPostData.postedAt instanceof Date
                ? originalPostData.postedAt
                : null,
              totalEngagement: originalPostData.totalEngagement ?? 0,
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
            typeof selectedPost.signedEvent.id === "string"
              ? typedStats[selectedPost.signedEvent.id]
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
