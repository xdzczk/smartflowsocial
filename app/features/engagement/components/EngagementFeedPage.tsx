import { useEffect } from "react";

import type { PostData } from "~/features/posts/server";
import { PostDetailsModal } from "~/features/posts/ui";
import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";

import { useEngagementInfiniteData } from "../hooks/useEngagementQuery";
import { useEngagementState } from "../hooks/useEngagementState";

import { EngagementContent } from "./EngagementContent";
import { EngagementHeader } from "./EngagementHeader";
import { EngagementTabs } from "./EngagementTabs";

export default function EngagementFeedPage() {
  // Use infinite query for data fetching with infinite scroll
  const {
    posts: safePosts,
    stats: safeStats,
    user: safeUser,
    groupedNotifications: safeGroupedNotifications,
    trustScores: safeTrustScores,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useEngagementInfiniteData();

  const { selectedPost, activeTab, setSelectedPost, setActiveTab } =
    useEngagementState();

  // Set up intersection observer for infinite scroll
  const { ref: sentinelRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.8,
  });

  // Prefetch sentinel - triggers earlier (70% threshold) to prefetch next page
  const { ref: prefetchSentinelRef, isIntersecting: isPrefetchIntersecting } =
    useIntersectionObserver({
      threshold: 0.7,
    });

  // Prefetch next page when user is 70% down (earlier than actual fetch at 80%)
  useEffect(() => {
    if (
      isPrefetchIntersecting &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isIntersecting
    ) {
      // Prefetch by calling fetchNextPage early
      void fetchNextPage();
    }
  }, [
    isPrefetchIntersecting,
    hasNextPage,
    isFetchingNextPage,
    isIntersecting,
    fetchNextPage,
  ]);

  // Fetch next page when sentinel becomes visible (backup in case prefetch didn't trigger)
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Extract user properties
  const userTimezone =
    safeUser &&
    "timezone" in safeUser &&
    typeof safeUser["timezone"] === "string"
      ? safeUser["timezone"]
      : undefined;
  const userRelays =
    safeUser &&
    "userRelays" in safeUser &&
    Array.isArray(safeUser["userRelays"])
      ? (safeUser["userRelays"] as string[])
      : undefined;

  return (
    <div>
      <EngagementHeader />

      <EngagementTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        repliesCount={safeGroupedNotifications.replies.length}
        quotesCount={safeGroupedNotifications.quotes.length}
      />

      <EngagementContent
        activeTab={activeTab}
        groupedNotifications={safeGroupedNotifications}
        userTimezone={userTimezone}
        userRelays={userRelays}
        trustScores={safeTrustScores}
        postsCount={safePosts.length}
      />

      {/* Scroll sentinel for infinite scroll */}
      {/* Prefetch sentinel - triggers at 70% to prefetch next page */}
      <div ref={prefetchSentinelRef} className="h-4 w-full" />
      {/* Main sentinel - triggers at 80% to ensure next page is loaded */}
      <div ref={sentinelRef} className="h-4 w-full" />

      {/* Loading indicator for next page */}
      {isFetchingNextPage ? (
        <div className="text-muted-foreground mt-4 text-center text-sm">
          Loading more notifications...
        </div>
      ) : null}

      {selectedPost &&
      typeof selectedPost === "object" &&
      "id" in selectedPost ? (
        <PostDetailsModal
          post={selectedPost as PostData}
          stats={(() => {
            if (
              typeof selectedPost === "object" &&
              "signedEvent" in selectedPost
            ) {
              const signedEvent = selectedPost.signedEvent;
              if (
                signedEvent &&
                typeof signedEvent === "object" &&
                "id" in signedEvent &&
                typeof signedEvent.id === "string"
              ) {
                const eventId = signedEvent.id;
                return safeStats[eventId];
              }
            }
            return;
          })()}
          onClose={() => setSelectedPost(null)}
          showStats={true}
          showSignedEvent={true}
          type="published"
          userTimezone={userTimezone}
        />
      ) : null}
    </div>
  );
}
