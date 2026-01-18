import type { PostData } from "~/features/posts/server";
import { PostDetailsModal } from "~/features/posts/ui";

import { useEngagementData } from "../hooks/useEngagementQuery";
import { useEngagementState } from "../hooks/useEngagementState";

import { EngagementContent } from "./EngagementContent";
import { EngagementHeader } from "./EngagementHeader";
import { EngagementTabs } from "./EngagementTabs";

export default function EngagementFeedPage() {
  // Use TanStack Query for data fetching with caching
  const {
    posts: safePosts,
    stats: safeStats,
    user: safeUser,
    groupedNotifications: safeGroupedNotifications,
    trustScores: safeTrustScores,
  } = useEngagementData();

  const { selectedPost, activeTab, setSelectedPost, setActiveTab } =
    useEngagementState();

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
          type="posted"
          userTimezone={userTimezone}
        />
      ) : null}
    </div>
  );
}
