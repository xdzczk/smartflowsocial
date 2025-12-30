import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useParams } from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
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
import {
  PostDetailsModal,
  type PostData,
} from "~/features/posts";
import { withErrorHandling } from "~/lib/error-handler.server";

async function loaderImpl({ request, params }: LoaderFunctionArgs) {
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
}

export const loader = withErrorHandling(loaderImpl);

type LoaderData = Awaited<ReturnType<typeof loaderImpl>>;

export default function GiveawayQueueRoute() {
  const data = useLoaderData<LoaderData>();
  const { posts, stats, relatedEvents, user, queueTypes, selectedQueueType } = data;
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
    posts: posts.map((post) => {
      // Convert PostData to Post format expected by useGiveawayState
      // useGiveawayState expects Post with postedAt: Date | null and totalEngagement: number
      return {
        ...post,
        postedAt: (() => {
          const postedAtValue: unknown = post.postedAt;
          if (postedAtValue === null || postedAtValue === undefined) return null;
          if (postedAtValue instanceof Date) return postedAtValue;
          if (typeof postedAtValue === "string") return new Date(postedAtValue);
          return null;
        })(),
        totalEngagement: typeof post.totalEngagement === "number" ? post.totalEngagement : 0,
      };
    })
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
        posts={filteredPosts as unknown as Parameters<typeof GiveawayTable>[0]["posts"]}
        sortConfig={sortConfig}
        onRequestSort={requestSort}
        onPostClick={(post) => {
          // Find the original PostData from posts array
          const originalPostData = posts.find(p => p.id === post.id);
          if (originalPostData) {
            // Convert to the Post format expected by useGiveawayState
            setSelectedPost({
              ...originalPostData,
              postedAt: (() => {
                const postedAtValue: unknown = originalPostData.postedAt;
                if (postedAtValue === null || postedAtValue === undefined) return null;
                if (postedAtValue instanceof Date) return postedAtValue;
                if (typeof postedAtValue === "string") return new Date(postedAtValue);
                return null;
              })(),
              totalEngagement: typeof originalPostData.totalEngagement === "number" ? originalPostData.totalEngagement : 0,
            });
          }
        }}
      />

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost as unknown as PostData}
          stats={selectedPost && typeof selectedPost === "object" && "signedEvent" in selectedPost && selectedPost.signedEvent && typeof selectedPost.signedEvent === "object" && "id" in selectedPost.signedEvent && typeof selectedPost.signedEvent.id === "string" ? stats[selectedPost.signedEvent.id] : undefined}
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
