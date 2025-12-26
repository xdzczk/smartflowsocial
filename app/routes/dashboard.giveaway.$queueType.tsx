import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useParams } from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { GiveawayFilters } from "~/features/giveaway/components/GiveawayFilters";
import { GiveawayQueueTabs } from "~/features/giveaway/components/GiveawayQueueTabs";
import GiveawayRandomizer from "~/features/giveaway/components/GiveawayRandomizer";
import { GiveawayTable } from "~/features/giveaway/components/GiveawayTable";
import { loadGiveawayData } from "~/features/giveaway/giveaway-loader.server";
import { useGiveawayState } from "~/features/giveaway/hooks/useGiveawayState";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import { withErrorHandling } from "~/lib/error-handler.server";

export const loader = withErrorHandling(async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to giveaway feature
  await requireFeatureAccess(userId, "giveaways");

  const url = new URL(request.url);
  const queueType = params.queueType || "all";
  const days = parseInt(url.searchParams.get("days") || "7");

  const data = await loadGiveawayData(userId, queueType, days);
  return data;
});

export default function GiveawayQueueRoute() {
  const { posts, stats, relatedEvents, user, queueTypes, selectedQueueType } =
    useLoaderData<typeof loader>();
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
  } = useGiveawayState({ posts });

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
        onPostClick={setSelectedPost}
      />

      {selectedPost ? (
        <PostDetailsModal
              post={selectedPost}
          stats={stats[selectedPost.signedEvent?.id || ""]}
          onClose={() => setSelectedPost(null)}
          showStats={true}
          showSignedEvent={true}
          type="posted"
          userTimezone={user?.timezone || undefined}
        />
      ) : null}
    </div>
  );
}
