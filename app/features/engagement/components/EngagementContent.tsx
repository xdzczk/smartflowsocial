/**
 * Engagement feed content component
 * Renders by type tab: All (replies + mentions), Replies, or Mentions (quotes + mention-type).
 */

import { useState } from "react";

import { EmptyState } from "~/components/ui/empty-state";

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
  onMarkDone: (
    eventId: string,
    repliedFromApp?: boolean,
    state?:
      | "UNHANDLED"
      | "DRAFTED"
      | "SCHEDULED"
      | "REPLIED"
      | "IGNORED"
      | "SNOOZED"
      | "HANDLED",
    snoozedUntil?: string | null
  ) => Promise<void>;
  userTimezone?: string | null;
  userRelays?: string[];
  trustScores: Record<string, number>;
  postsCount: number;
  focusedIndex?: number;
  registerKeyboardHandlers?: (
    index: number,
    handlers: {
      openReply: () => void;
      openQuote?: () => void;
      openRepost?: () => void;
      like: () => void;
      markDone: () => void;
      ignore?: () => void;
      snooze?: () => void;
      publishNow?: () => void;
      schedule?: () => void;
      expandThread: () => void;
    } | null
  ) => void;
  replyTemplates?: ReplyTemplate[];
  engagementLinkedActions?: Record<
    string,
    Array<{
      kind: string;
      label?: string | null;
      scheduledFor?: string | null;
      postId?: string | null;
      draftId?: string | null;
    }>
  >;
  groupSummaries?: Record<
    string,
    {
      total: number;
      needResponse: number;
      drafted: number;
      scheduled: number;
      handled: number;
    }
  >;
  followedPubkeys?: string[];
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
  engagementLinkedActions = {},
  groupSummaries = {},
  followedPubkeys = [],
}: EngagementContentProps) {
  const [activeNotificationEventId, setActiveNotificationEventId] = useState<
    string | null
  >(null);
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
    engagementLinkedActions,
    groupSummaries,
    followedPubkeys,
    activeNotificationEventId,
    setActiveNotificationEventId,
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
            listVariant="replies"
          />
        ) : null}

        {groupedMentionsTab.length > 0 ? (
          <GroupedNotificationList
            groupedNotifications={groupedMentionsTab}
            {...listProps}
            baseIndex={repliesFlatCount}
            listVariant="mentions"
          />
        ) : null}

        {groupedReplies.length === 0 && groupedMentionsTab.length === 0 ? (
          <div className="border-border bg-surface rounded-lg border">
            <EmptyState title="No engagement found for your posts yet." />
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
            listVariant="replies"
          />
        ) : (
          <div className="border-border bg-surface rounded-lg border">
            <EmptyState
              title="No replies found for your posts."
              description={`Posts fetched: ${postsCount}`}
            />
          </div>
        )}
      </>
    );
  }

  if (activeTab === "needs-response") {
    return (
      <div className="space-y-6">
        {groupedReplies.length > 0 ? (
          <GroupedNotificationList
            groupedNotifications={groupedReplies}
            {...listProps}
            baseIndex={0}
            listVariant="replies"
          />
        ) : null}
        {groupedMentionsTab.length > 0 ? (
          <GroupedNotificationList
            groupedNotifications={groupedMentionsTab}
            {...listProps}
            baseIndex={repliesFlatCount}
            listVariant="mentions"
          />
        ) : null}
        {groupedReplies.length === 0 && groupedMentionsTab.length === 0 ? (
          <div className="border-border bg-surface rounded-lg border">
            <EmptyState title="Nothing needs response right now." />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {groupedMentionsTab.length > 0 ? (
        <GroupedNotificationList
          groupedNotifications={groupedMentionsTab}
          {...listProps}
          baseIndex={0}
          listVariant="mentions"
        />
      ) : (
        <div className="border-border bg-surface rounded-lg border">
          <EmptyState title="No mentions or quote reposts found for your posts." />
        </div>
      )}
    </>
  );
}
