/**
 * Engagement feed content component
 */

import type { GroupedNotification } from "../types";

import GroupedNotificationList from "./GroupedNotificationList";
interface EngagementContentProps {
  activeTab: "all" | "replies" | "quotes";
  groupedNotifications: {
    replies: GroupedNotification[];
    quotes: GroupedNotification[];
  };
  userTimezone?: string | null;
  userRelays?: string[];
  trustScores: Record<string, number>;
  postsCount: number;
}

export function EngagementContent({
  activeTab,
  groupedNotifications,
  userTimezone,
  userRelays,
  trustScores,
  postsCount,
}: EngagementContentProps) {
  const defaultRelays = ["wss://relay.primal.net"];

  // All Tab Content
  if (activeTab === "all") {
    return (
      <div className="space-y-6">
        {/* Replies Section */}
        {groupedNotifications.replies.length > 0 ? (
          <div>
            <h4 className="text-foreground mb-3 font-medium">Replies</h4>
            <GroupedNotificationList
              groupedNotifications={groupedNotifications.replies}
              userTimezone={userTimezone ?? undefined}
              userRelays={userRelays ?? defaultRelays}
              trustScores={trustScores}
            />
          </div>
        ) : null}

        {/* Quote Reposts Section */}
        {groupedNotifications.quotes.length > 0 ? (
          <div>
            <h4 className="text-foreground mb-3 font-medium">
              Repost with Quote
            </h4>
            <GroupedNotificationList
              groupedNotifications={groupedNotifications.quotes}
              userTimezone={userTimezone ?? undefined}
              userRelays={userRelays ?? defaultRelays}
              trustScores={trustScores}
            />
          </div>
        ) : null}

        {groupedNotifications.replies.length === 0 &&
        groupedNotifications.quotes.length === 0 ? (
          <div className="border-border bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              No engagement found for your posts yet.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  // Replies Tab Content
  if (activeTab === "replies") {
    return (
      <>
        {groupedNotifications.replies.length > 0 ? (
          <GroupedNotificationList
            groupedNotifications={groupedNotifications.replies}
            userTimezone={userTimezone ?? undefined}
            userRelays={userRelays ?? defaultRelays}
            trustScores={trustScores}
          />
        ) : (
          <div className="border-border bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              No replies found for your posts.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              Posts fetched: {postsCount}
            </p>
          </div>
        )}
      </>
    );
  }

  // Quote Reposts Tab Content
  // activeTab must be "quotes" at this point due to type narrowing
  return (
    <>
      {groupedNotifications.quotes.length > 0 ? (
        <GroupedNotificationList
          groupedNotifications={groupedNotifications.quotes}
          userTimezone={userTimezone ?? undefined}
          userRelays={userRelays ?? defaultRelays}
          trustScores={trustScores}
        />
      ) : (
        <div className="border-border bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">
            No quote reposts found for your posts.
          </p>
        </div>
      )}
    </>
  );
}
