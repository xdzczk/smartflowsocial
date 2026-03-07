import { useEffect, useMemo, useRef, useState } from "react";

import type { PostData } from "~/features/posts/server";
import { PostDetailsModal } from "~/features/posts/ui";
import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";

import {
  applyPowerFilters,
  applySort,
  filterByInboxTab,
  getFlatItemCount,
} from "../engagement-filter";
import { useEngagementKeyboard } from "../hooks/useEngagementKeyboard";
import {
  useEngagementInfiniteData,
  useMarkEngagementDone,
} from "../hooks/useEngagementQuery";
import { useEngagementState } from "../hooks/useEngagementState";
import { useReplyTemplates } from "../hooks/useReplyTemplates";

import { EngagementContent } from "./EngagementContent";
import { EngagementFilterBar } from "./EngagementFilterBar";
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
    engagementItemStates: safeEngagementItemStates,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useEngagementInfiniteData();

  const {
    selectedPost,
    inboxTab,
    setInboxTab,
    activeTab,
    setActiveTab,
    setSelectedPost,
    filterHighReputation,
    setFilterHighReputation,
    filterMentionsOnly,
    setFilterMentionsOnly,
    sortBy,
    setSortBy,
  } = useEngagementState();
  const { markDone } = useMarkEngagementDone();
  const { templates: replyTemplates, load: loadReplyTemplates } =
    useReplyTemplates({ enabled: true });

  useEffect(() => {
    loadReplyTemplates();
  }, [loadReplyTemplates]);

  // Filtered groups (same as EngagementContent) for keyboard flat list count
  const engagementStates = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- safeEngagementItemStates can be undefined before load
    return safeEngagementItemStates ?? {};
  }, [safeEngagementItemStates]);
  const filteredReplies = useMemo(
    () =>
      filterByInboxTab(
        safeGroupedNotifications.replies,
        inboxTab,
        engagementStates
      ),
    [safeGroupedNotifications.replies, inboxTab, engagementStates]
  );
  const filteredQuotes = useMemo(
    () =>
      filterByInboxTab(
        safeGroupedNotifications.quotes,
        inboxTab,
        engagementStates
      ),
    [safeGroupedNotifications.quotes, inboxTab, engagementStates]
  );
  const afterPowerReplies = useMemo(
    () =>
      applySort(
        applyPowerFilters(
          filteredReplies,
          safeTrustScores,
          filterHighReputation,
          filterMentionsOnly
        ),
        safeTrustScores,
        sortBy
      ),
    [
      filteredReplies,
      safeTrustScores,
      filterHighReputation,
      filterMentionsOnly,
      sortBy,
    ]
  );
  const afterPowerQuotes = useMemo(
    () =>
      applySort(
        applyPowerFilters(
          filteredQuotes,
          safeTrustScores,
          filterHighReputation,
          filterMentionsOnly
        ),
        safeTrustScores,
        sortBy
      ),
    [
      filteredQuotes,
      safeTrustScores,
      filterHighReputation,
      filterMentionsOnly,
      sortBy,
    ]
  );
  const flatItemCount =
    activeTab === "replies"
      ? getFlatItemCount(afterPowerReplies)
      : activeTab === "quotes"
        ? getFlatItemCount(afterPowerQuotes)
        : getFlatItemCount(afterPowerReplies) +
          getFlatItemCount(afterPowerQuotes);

  const { focusedIndex, registerHandlers: registerKeyboardHandlers } =
    useEngagementKeyboard(
      flatItemCount,
      !selectedPost /* disable when modal open */
    );

  // Count notifications by inbox state for tab badges
  const inboxCounts = (() => {
    let unread = 0;
    let handled = 0;
    let replied = 0;
    const states = engagementStates;
    for (const group of [
      ...safeGroupedNotifications.replies,
      ...safeGroupedNotifications.quotes,
    ]) {
      for (const n of group.notifications) {
        const s = n.eventId ? states[n.eventId] : undefined;
        if (!s) {
          unread++;
        } else {
          handled++;
          if (s.repliedFromApp) replied++;
        }
      }
    }
    return { unread, handled, replied };
  })();

  // "New replies" badge when background refetch returns more unread than last seen
  const lastSeenUnreadRef = useRef<number | null>(null);
  const [newRepliesCount, setNewRepliesCount] = useState(0);
  useEffect(() => {
    const current = inboxCounts.unread;
    if (lastSeenUnreadRef.current === null) {
      lastSeenUnreadRef.current = current;
      return;
    }
    if (current > lastSeenUnreadRef.current) {
      setNewRepliesCount(current - lastSeenUnreadRef.current);
    }
  }, [inboxCounts.unread]);
  const dismissNewRepliesBadge = () => {
    lastSeenUnreadRef.current = inboxCounts.unread;
    setNewRepliesCount(0);
  };

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
        inboxTab={inboxTab}
        onInboxTabChange={setInboxTab}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unreadCount={inboxCounts.unread}
        handledCount={inboxCounts.handled}
        repliedCount={inboxCounts.replied}
        repliesCount={safeGroupedNotifications.replies.length}
        quotesCount={safeGroupedNotifications.quotes.length}
      />

      <EngagementFilterBar
        filterHighReputation={filterHighReputation}
        setFilterHighReputation={setFilterHighReputation}
        filterMentionsOnly={filterMentionsOnly}
        setFilterMentionsOnly={setFilterMentionsOnly}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      {newRepliesCount > 0 ? (
        <div className="bg-primary/10 border-primary/30 mb-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <span className="text-foreground text-sm font-medium">
            {newRepliesCount} new repl{newRepliesCount === 1 ? "y" : "ies"}
          </span>
          <button
            type="button"
            onClick={dismissNewRepliesBadge}
            className="text-primary hover:bg-primary/20 rounded px-2 py-1 text-sm font-medium"
          >
            Show
          </button>
        </div>
      ) : null}

      <EngagementContent
        inboxTab={inboxTab}
        activeTab={activeTab}
        groupedNotifications={safeGroupedNotifications}
        engagementItemStates={engagementStates}
        onMarkDone={markDone}
        userTimezone={userTimezone}
        userRelays={userRelays}
        trustScores={safeTrustScores}
        postsCount={safePosts.length}
        filterHighReputation={filterHighReputation}
        filterMentionsOnly={filterMentionsOnly}
        sortBy={sortBy}
        focusedIndex={focusedIndex}
        registerKeyboardHandlers={registerKeyboardHandlers}
        replyTemplates={replyTemplates}
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
