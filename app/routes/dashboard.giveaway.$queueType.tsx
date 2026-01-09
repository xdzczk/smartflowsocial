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
import { type PostData, type CombinedContent } from "~/features/posts/server";
import { PostDetailsModal } from "~/features/posts/ui";
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
    const queueType = params["queueType"] ?? "all";
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

      <div className="mt-5 mb-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
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
        currentQueueType={params["queueType"]}
      />

      <div className="mb-2 text-sm text-gray-500">
        Showing {filteredPosts.length} posts with engagement
        {selectedQueueType !== "all" ? ` for ${selectedQueueType} queue` : null}
      </div>

      <GiveawayTable
        posts={
          filteredPosts as Array<{
            id: string;
            caption?: string | null;
            postedAt: Date | null;
            fileUrl: string[];
            signedEvent?: { id: string } | null;
            queueType?: { name: string; color?: string | null } | null;
            repost?: boolean;
            isQuotedPost?: boolean;
            totalEngagement: number;
            stats?: {
              likes: number;
              replies: number;
              mentions: number;
              reposts: number;
              zaps: number;
              satszapped: number;
            };
            [key: string]: unknown;
          }>
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
              postedAt:
                originalPostData.postedAt instanceof Date
                  ? originalPostData.postedAt
                  : null,
              totalEngagement: originalPostData.totalEngagement ?? 0,
            });
          }
        }}
      />

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost as unknown as PostData | CombinedContent}
          stats={
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: type narrowing for serialized data
            selectedPost &&
            typeof selectedPost === "object" &&
            "signedEvent" in selectedPost &&
            selectedPost["signedEvent"] &&
            typeof selectedPost["signedEvent"] === "object" &&
            "id" in selectedPost["signedEvent"] &&
            typeof selectedPost["signedEvent"]["id"] === "string"
              ? typedStats[selectedPost["signedEvent"]["id"]]
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
