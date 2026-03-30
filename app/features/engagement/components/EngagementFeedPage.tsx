import { useEffect, useMemo, useRef } from "react";

import type { PostData } from "~/features/posts/server";
import { PostDetailsModal } from "~/features/posts/ui";
import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";

import {
  applyPowerFilters,
  applySort,
  applyWorkflowFilters,
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
    engagementLinkedActions: safeEngagementLinkedActions,
    groupSummaries: safeGroupSummaries,
    followedPubkeys: safeFollowedPubkeys,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useEngagementInfiniteData();

  const {
    selectedPost,
    setSelectedPost,
    activeTab,
    setActiveTab,
    filterHighReputation,
    setFilterHighReputation,
    filterFollowingOnly,
    setFilterFollowingOnly,
    sortBy,
    setSortBy,
    filterUnhandledOnly,
    setFilterUnhandledOnly,
    filterHasDraft,
    setFilterHasDraft,
    filterHasScheduledAction,
    setFilterHasScheduledAction,
    includeScheduledInNeedsResponse,
    setIncludeScheduledInNeedsResponse,
  } = useEngagementState();
  const { markDone } = useMarkEngagementDone();
  const { templates: replyTemplates, load: loadReplyTemplates } =
    useReplyTemplates({ enabled: true });

  const hasLoadedReplyTemplatesRef = useRef(false);
  useEffect(() => {
    if (hasLoadedReplyTemplatesRef.current) return;
    hasLoadedReplyTemplatesRef.current = true;
    loadReplyTemplates();
  }, [loadReplyTemplates]);

  const engagementStates = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- safeEngagementItemStates can be undefined before load
    return safeEngagementItemStates ?? {};
  }, [safeEngagementItemStates]);

  const followedPubkeysSet = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- safeFollowedPubkeys can be undefined before load
      new Set(safeFollowedPubkeys ?? []),
    [safeFollowedPubkeys]
  );
  const engagementLinkedActions = useMemo(
    () => safeEngagementLinkedActions,
    [safeEngagementLinkedActions]
  );

  const safeReplies = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- replies can be undefined before load
      safeGroupedNotifications.replies ?? [],
    [safeGroupedNotifications.replies]
  );
  const safeQuotes = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- quotes can be undefined before load
      safeGroupedNotifications.quotes ?? [],
    [safeGroupedNotifications.quotes]
  );
  const safeMentions = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mentions can be undefined before load
      safeGroupedNotifications.mentions ?? [],
    [safeGroupedNotifications.mentions]
  );

  const mergedMentionsTab = useMemo(() => {
    const combined = [...safeQuotes, ...safeMentions];
    return combined.sort((a, b) => {
      const maxA = Math.max(...a.notifications.map((n) => n.createdAt), 0);
      const maxB = Math.max(...b.notifications.map((n) => n.createdAt), 0);
      return maxB - maxA;
    });
  }, [safeQuotes, safeMentions]);

  const afterPowerReplies = useMemo(
    () =>
      applySort(
        applyPowerFilters(
          safeReplies,
          safeTrustScores,
          filterHighReputation,
          filterFollowingOnly,
          followedPubkeysSet
        ),
        safeTrustScores,
        sortBy
      ),
    [
      safeReplies,
      safeTrustScores,
      filterHighReputation,
      filterFollowingOnly,
      followedPubkeysSet,
      sortBy,
    ]
  );
  const afterPowerMentionsTab = useMemo(
    () =>
      applySort(
        applyPowerFilters(
          mergedMentionsTab,
          safeTrustScores,
          filterHighReputation,
          filterFollowingOnly,
          followedPubkeysSet
        ),
        safeTrustScores,
        sortBy
      ),
    [
      mergedMentionsTab,
      safeTrustScores,
      filterHighReputation,
      filterFollowingOnly,
      followedPubkeysSet,
      sortBy,
    ]
  );
  const afterWorkflowReplies = useMemo(
    () =>
      applyWorkflowFilters(
        afterPowerReplies,
        engagementStates,
        engagementLinkedActions,
        {
          unhandledOnly: filterUnhandledOnly,
          hasDraft: filterHasDraft,
          hasScheduledAction: filterHasScheduledAction,
          needsResponse: activeTab === "needs-response",
          includeScheduledInNeedsResponse,
        }
      ),
    [
      afterPowerReplies,
      engagementStates,
      engagementLinkedActions,
      filterUnhandledOnly,
      filterHasDraft,
      filterHasScheduledAction,
      activeTab,
      includeScheduledInNeedsResponse,
    ]
  );
  const afterWorkflowMentions = useMemo(
    () =>
      applyWorkflowFilters(
        afterPowerMentionsTab,
        engagementStates,
        engagementLinkedActions,
        {
          unhandledOnly: filterUnhandledOnly,
          hasDraft: filterHasDraft,
          hasScheduledAction: filterHasScheduledAction,
          needsResponse: activeTab === "needs-response",
          includeScheduledInNeedsResponse,
        }
      ),
    [
      afterPowerMentionsTab,
      engagementStates,
      engagementLinkedActions,
      filterUnhandledOnly,
      filterHasDraft,
      filterHasScheduledAction,
      activeTab,
      includeScheduledInNeedsResponse,
    ]
  );
  const needsResponseCount = useMemo(() => {
    const replies = applyWorkflowFilters(
      afterPowerReplies,
      engagementStates,
      engagementLinkedActions,
      {
        unhandledOnly: false,
        hasDraft: false,
        hasScheduledAction: false,
        needsResponse: true,
        includeScheduledInNeedsResponse,
      }
    );
    const mentions = applyWorkflowFilters(
      afterPowerMentionsTab,
      engagementStates,
      engagementLinkedActions,
      {
        unhandledOnly: false,
        hasDraft: false,
        hasScheduledAction: false,
        needsResponse: true,
        includeScheduledInNeedsResponse,
      }
    );
    return getFlatItemCount(replies) + getFlatItemCount(mentions);
  }, [
    afterPowerReplies,
    afterPowerMentionsTab,
    engagementStates,
    engagementLinkedActions,
    includeScheduledInNeedsResponse,
  ]);
  const flatItemCount =
    activeTab === "replies"
      ? getFlatItemCount(afterWorkflowReplies)
      : activeTab === "mentions"
        ? getFlatItemCount(afterWorkflowMentions)
        : getFlatItemCount(afterWorkflowReplies) +
          getFlatItemCount(afterWorkflowMentions);

  const { focusedIndex, registerHandlers: registerKeyboardHandlers } =
    useEngagementKeyboard(
      flatItemCount,
      !selectedPost /* disable when modal open */
    );

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

      <div className="border-border mb-6 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <EngagementTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          repliesCount={getFlatItemCount(safeGroupedNotifications.replies)}
          mentionsCount={
            getFlatItemCount(safeGroupedNotifications.quotes) +
            getFlatItemCount(safeGroupedNotifications.mentions)
          }
          needsResponseCount={needsResponseCount}
        />
        <EngagementFilterBar
          filterHighReputation={filterHighReputation}
          setFilterHighReputation={setFilterHighReputation}
          filterFollowingOnly={filterFollowingOnly}
          setFilterFollowingOnly={setFilterFollowingOnly}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filterUnhandledOnly={filterUnhandledOnly}
          setFilterUnhandledOnly={setFilterUnhandledOnly}
          filterHasDraft={filterHasDraft}
          setFilterHasDraft={setFilterHasDraft}
          filterHasScheduledAction={filterHasScheduledAction}
          setFilterHasScheduledAction={setFilterHasScheduledAction}
          includeScheduledInNeedsResponse={includeScheduledInNeedsResponse}
          setIncludeScheduledInNeedsResponse={
            setIncludeScheduledInNeedsResponse
          }
        />
      </div>

      <EngagementContent
        activeTab={activeTab}
        groupedReplies={afterWorkflowReplies}
        groupedMentionsTab={afterWorkflowMentions}
        engagementItemStates={engagementStates}
        onMarkDone={markDone}
        userTimezone={userTimezone}
        userRelays={userRelays}
        trustScores={safeTrustScores}
        postsCount={safePosts.length}
        focusedIndex={focusedIndex}
        registerKeyboardHandlers={registerKeyboardHandlers}
        replyTemplates={replyTemplates}
        engagementLinkedActions={engagementLinkedActions}
        groupSummaries={safeGroupSummaries}
        followedPubkeys={safeFollowedPubkeys}
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
