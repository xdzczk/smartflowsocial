/**
 * Engagement feed content component
 * Filters by inbox tab (unread/all/handled/replied) and type tab (all/replies/quotes).
 */

import {
  applyPowerFilters,
  applySort,
  filterByInboxTab,
  type EngagementItemStateMap,
} from "../engagement-filter";
import type { InboxTab, EngagementSortBy } from "../hooks/useEngagementState";
import type { ReplyTemplate } from "../hooks/useReplyTemplates";
import type { GroupedNotification } from "../types";

import GroupedNotificationList from "./GroupedNotificationList";

interface EngagementContentProps {
  inboxTab: InboxTab;
  activeTab: "all" | "replies" | "quotes";
  groupedNotifications: {
    replies: GroupedNotification[];
    quotes: GroupedNotification[];
  };
  engagementItemStates: EngagementItemStateMap;
  onMarkDone: (eventId: string, repliedFromApp?: boolean) => Promise<void>;
  userTimezone?: string | null;
  userRelays?: string[];
  trustScores: Record<string, number>;
  postsCount: number;
  filterHighReputation?: boolean;
  filterMentionsOnly?: boolean;
  sortBy?: EngagementSortBy;
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
  inboxTab,
  activeTab,
  groupedNotifications,
  engagementItemStates,
  onMarkDone,
  userTimezone,
  userRelays,
  trustScores,
  postsCount,
  filterHighReputation = false,
  filterMentionsOnly = false,
  sortBy = "newest",
  focusedIndex = -1,
  registerKeyboardHandlers,
  replyTemplates = [],
}: EngagementContentProps) {
  const defaultRelays = ["wss://relay.primal.net"];
  const afterInboxReplies = filterByInboxTab(
    groupedNotifications.replies,
    inboxTab,
    engagementItemStates
  );
  const afterInboxQuotes = filterByInboxTab(
    groupedNotifications.quotes,
    inboxTab,
    engagementItemStates
  );
  const filteredReplies = applySort(
    applyPowerFilters(
      afterInboxReplies,
      trustScores,
      filterHighReputation,
      filterMentionsOnly
    ),
    trustScores,
    sortBy
  );
  const filteredQuotes = applySort(
    applyPowerFilters(
      afterInboxQuotes,
      trustScores,
      filterHighReputation,
      filterMentionsOnly
    ),
    trustScores,
    sortBy
  );

  const repliesFlatCount = filteredReplies.reduce(
    (s, g) => s + g.notifications.length,
    0
  );

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

  // All Tab Content
  if (activeTab === "all") {
    return (
      <div className="space-y-6">
        {filteredReplies.length > 0 ? (
          <div>
            <h4 className="text-foreground mb-3 font-medium">Replies</h4>
            <GroupedNotificationList
              groupedNotifications={filteredReplies}
              {...listProps}
              baseIndex={0}
            />
          </div>
        ) : null}

        {filteredQuotes.length > 0 ? (
          <div>
            <h4 className="text-foreground mb-3 font-medium">
              Repost with Quote
            </h4>
            <GroupedNotificationList
              groupedNotifications={filteredQuotes}
              {...listProps}
              baseIndex={repliesFlatCount}
            />
          </div>
        ) : null}

        {filteredReplies.length === 0 && filteredQuotes.length === 0 ? (
          <div className="border-border bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              {inboxTab === "unread"
                ? "No unread engagement."
                : inboxTab === "handled"
                  ? "No handled items."
                  : inboxTab === "replied"
                    ? "No replies from you yet."
                    : "No engagement found for your posts yet."}
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  if (activeTab === "replies") {
    return (
      <>
        {filteredReplies.length > 0 ? (
          <GroupedNotificationList
            groupedNotifications={filteredReplies}
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

  // activeTab === "quotes"
  return (
    <>
      {filteredQuotes.length > 0 ? (
        <GroupedNotificationList
          groupedNotifications={filteredQuotes}
          {...listProps}
          baseIndex={0}
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
