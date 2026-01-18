import { useParams } from "@remix-run/react";

import { type CombinedContent, type PostData } from "~/features/posts/server";
import { PostDetailsModal } from "~/features/posts/ui";

import { useGiveawayData } from "../hooks/useGiveawayQuery";
import { useGiveawayState } from "../hooks/useGiveawayState";

import { GiveawayFilters } from "./GiveawayFilters";
import { GiveawayQueueTabs } from "./GiveawayQueueTabs";
import GiveawayRandomizer from "./GiveawayRandomizer";
import { GiveawayTable } from "./GiveawayTable";

export default function GiveawayPage() {
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
        currentQueueType={params["queueType"]}
      />

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
