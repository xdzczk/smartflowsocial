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
import { PostDetailsModal } from "~/features/posts/ui";
import { type PostData } from "~/features/posts/server";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { giveawayLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
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
    
    // Validate loader response with Zod schema
    return validateLoaderResponse(data, giveawayLoaderDataSchema);
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

export default function GiveawayQueueRoute() {
  // Use TanStack Query for data fetching with caching
  const {
    posts: typedPosts,
    stats: typedStats,
    relatedEvents,
    user,
    queueTypes,
    selectedQueueType,
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

      <div className="mb-5 mt-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <h3 className="mb-1 font-semibold">
            Top posts -{" "}
            {selectedQueueType === "all"
              ? "All Queues"
              : selectedQueueType.charAt(0).toUpperCase() +
                selectedQueueType.slice(1)}
          </h3>
        </div>
      </div>

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

      <div className="mb-2 text-sm text-gray-500">
        Showing {filteredPosts.length} posts with engagement
        {selectedQueueType !== "all" ? ` for ${selectedQueueType} queue` : null}
      </div>

      <GiveawayTable
        posts={filteredPosts}
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
          post={selectedPost}
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
