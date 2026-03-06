import { Link, useParams } from "@remix-run/react";

import { type CombinedContent, type PostData } from "~/features/posts/server";
import { PostDetailsModal } from "~/features/posts/ui";

import { useGiveawayData } from "../hooks/useGiveawayQuery";
import { useGiveawayState } from "../hooks/useGiveawayState";

import { GiveawayFilters } from "./GiveawayFilters";
import { GiveawayQueueTabs } from "./GiveawayQueueTabs";
import GiveawayRandomizer from "./GiveawayRandomizer";
import { GiveawayTable } from "./GiveawayTable";

export default function GiveawayPage() {
  const {
    posts: typedPosts,
    stats: typedStats,
    relatedEvents,
    user,
    queueTypes,
    giveaways,
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
      publishedAt: post.publishedAt instanceof Date ? post.publishedAt : null,
      totalEngagement: post.totalEngagement ?? 0,
    })),
  });

  return (
    <div>
      <div className="border-border bg-card mb-4 flex items-center justify-between rounded-lg border p-4">
        <div>
          <h2 className="text-foreground font-semibold">Your giveaways</h2>
          <p className="text-muted-foreground text-sm">
            Create a giveaway, preview winners, then lock and pay out.
          </p>
        </div>
        <Link
          to="/dashboard/giveaway/new"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
        >
          New giveaway
        </Link>
      </div>
      {giveaways.length > 0 ? (
        <ul className="border-border bg-muted/20 mb-4 rounded-lg border p-3">
          {giveaways.map((g) => (
            <li key={g.id} className="flex items-center justify-between py-1">
              <Link
                to={`/dashboard/giveaway/${g.id}`}
                className="text-foreground hover:underline"
              >
                {g.id.slice(0, 8)}… · {g.status} · {g.winnerCount} winner
                {g.winnerCount !== 1 ? "s" : ""}
              </Link>
              <span className="text-muted-foreground text-xs">
                {new Date(g.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

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
            publishedAt: Date | null;
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
              publishedAt:
                originalPostData.publishedAt instanceof Date
                  ? originalPostData.publishedAt
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
          type="published"
          userTimezone={user?.timezone ?? undefined}
        />
      ) : null}
    </div>
  );
}
