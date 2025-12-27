import { json, type LoaderFunctionArgs } from "@remix-run/node";
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
async function loaderImpl({ request, params }: LoaderFunctionArgs) {
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
}

export const loader = withErrorHandling(loaderImpl);

type LoaderData = Awaited<ReturnType<typeof loaderImpl>>;

export default function PostedPosts() {
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
  } = useGiveawayState({ posts });

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
        posts={filteredPosts as unknown as { id: string; caption?: string; fileUrl?: string[]; signedEvent?: unknown }[]}
        sortConfig={sortConfig}
        onRequestSort={requestSort}
        onPostClick={(post) => setSelectedPost(post as unknown as { id: string; caption?: string; fileUrl?: string[]; signedEvent?: unknown } | null)}
      />

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost as unknown as { id: string; caption?: string; fileUrl?: string[]; signedEvent?: unknown; queueType?: { name: string } | null }}
          stats={selectedPost && typeof selectedPost === "object" && "signedEvent" in selectedPost && selectedPost.signedEvent && typeof selectedPost.signedEvent === "object" && "id" in selectedPost.signedEvent && typeof selectedPost.signedEvent.id === "string" && stats && typeof stats === "object" && !Array.isArray(stats) ? stats[selectedPost.signedEvent.id] : undefined}
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
