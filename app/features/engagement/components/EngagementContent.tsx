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
            <h4 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
              Replies
            </h4>
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
            <h4 className="mb-3 font-medium text-gray-900 dark:text-gray-100">
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
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-500 dark:text-gray-400">
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
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-500 dark:text-gray-400">
              No replies found for your posts.
            </p>
            <p className="mt-2 text-sm text-gray-400">
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
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">
            No quote reposts found for your posts.
          </p>
        </div>
      )}
    </>
  );
}
