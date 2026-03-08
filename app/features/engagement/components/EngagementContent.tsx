/**
 * Engagement feed content component
 * Renders by type tab: All (replies + mentions), Replies, or Mentions (quotes + mention-type).
 */

import type { EngagementItemStateMap } from "../engagement-filter";
import type { EngagementTypeTab } from "../hooks/useEngagementState";
import type { ReplyTemplate } from "../hooks/useReplyTemplates";
import type { GroupedNotification } from "../types";

import GroupedNotificationList from "./GroupedNotificationList";

interface EngagementContentProps {
  activeTab: EngagementTypeTab;
  groupedReplies: GroupedNotification[];
  groupedMentionsTab: GroupedNotification[];
  engagementItemStates: EngagementItemStateMap;
  onMarkDone: (eventId: string, repliedFromApp?: boolean) => Promise<void>;
  userTimezone?: string | null;
  userRelays?: string[];
  trustScores: Record<string, number>;
  postsCount: number;
  /** Keyboard: focused item index in the flat list; pass -1 to disable. */
  focusedIndex?: number;
  /** Keyboard: register handlers for the item at this index. */
  registerKeyboardHandlers?: (
    index: number,
    handlers: {
      openReply: () => void;
      like: () => void;
      markDone: () => void;
      expandThread: () => void;
    } | null
  ) => void;
  /** Reply templates for slash-command / Insert template in reply panel */
  replyTemplates?: ReplyTemplate[];
}

export function EngagementContent({
  activeTab,
  groupedReplies,
  groupedMentionsTab,
  engagementItemStates,
  onMarkDone,
  userTimezone,
  userRelays,
  trustScores,
  postsCount,
  focusedIndex = -1,
  registerKeyboardHandlers,
  replyTemplates = [],
}: EngagementContentProps) {
  const defaultRelays = ["wss://relay.primal.net"];
  const listProps = {
    userTimezone: userTimezone ?? undefined,
    userRelays: userRelays ?? defaultRelays,
    trustScores,
    engagementItemStates,
    onMarkDone,
    focusedIndex,
    registerKeyboardHandlers,
    replyTemplates,
  };

  const repliesFlatCount = groupedReplies.reduce(
    (s, g) => s + g.notifications.length,
    0
  );

  if (activeTab === "all") {
    return (
      <div className="space-y-6">
        {groupedReplies.length > 0 ? (
          <GroupedNotificationList
            groupedNotifications={groupedReplies}
            {...listProps}
            baseIndex={0}
          />
        ) : null}

        {groupedMentionsTab.length > 0 ? (
          <GroupedNotificationList
            groupedNotifications={groupedMentionsTab}
            {...listProps}
            baseIndex={repliesFlatCount}
          />
        ) : null}

        {groupedReplies.length === 0 && groupedMentionsTab.length === 0 ? (
          <div className="border-border bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              No engagement found for your posts yet.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  if (activeTab === "replies") {
    return (
      <>
        {groupedReplies.length > 0 ? (
          <GroupedNotificationList
            groupedNotifications={groupedReplies}
            {...listProps}
            baseIndex={0}
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

  // activeTab === "mentions"
  return (
    <>
      {groupedMentionsTab.length > 0 ? (
        <GroupedNotificationList
          groupedNotifications={groupedMentionsTab}
          {...listProps}
          baseIndex={0}
        />
      ) : (
        <div className="border-border bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">
            No mentions or quote reposts found for your posts.
          </p>
        </div>
      )}
    </>
  );
}
