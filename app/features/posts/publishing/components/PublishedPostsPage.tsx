import { useParams, useSearchParams, useNavigate } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Toast from "~/components/ui/Toast";
import { getSelectableRootIdsForMixedListing } from "~/features/posts/components/all-content-listing-selectable";
import { ContentBulkActions } from "~/features/posts/components/ContentBulkActions";
import { DateRangeQuickPresets } from "~/features/posts/components/DateRangeQuickPresets";
import { getLongFormPublishedEventId } from "~/features/posts/components/post-detail-modal/post-detail-helpers";
import PublishResultModal from "~/features/posts/components/PublishResultModal";
import { BulkComposerModal } from "~/features/posts/composer";
import { usePostResultFromUrl } from "~/features/posts/hooks/usePostResultFromUrl";
import { usePostStatsQuery } from "~/features/posts/hooks/usePostStatsQuery";
import { useRefreshPostViews } from "~/features/posts/hooks/useRefreshPostViews";
import {
  LongFormDetailsModal,
  LongFormListing,
} from "~/features/posts/longform";
import { ScheduleRepostQuoteModal } from "~/features/posts/scheduling";
import type {
  PostData,
  LongFormPostData,
  PostFetcher,
} from "~/features/posts/server";
import type { PostStats } from "~/features/posts/stats.server";
import type { BulkPost } from "~/features/posts/types";
import {
  AllContentListing,
  FilterDateRangeControls,
  FilterToolbarRow,
  PostDetailsModal,
  PublishingArchiveModeLinks,
  PublishingFilterRow,
  PublishingLibraryContentSegments,
  PublishingLibraryShell,
  PublishingPageHeader,
  PublishingQueueFilter,
} from "~/features/posts/ui";
import {
  isAttachedFollowUpPost,
  isStandaloneRepostPost,
} from "~/features/posts/utils/attached-follow-up-rows";
import { loadScheduledRepostDataAsBulkPosts } from "~/features/posts/utils/bulk-composer-data";
import {
  isPureRepostSourceContent,
  isRepostPost,
} from "~/features/posts/utils/content-helpers";
import { getTodayInTimezone } from "~/features/posts/utils/date-range-filter";
import {
  determineModalAction,
  getNewPostUrl,
  getPostTypeFromPost,
} from "~/features/posts/utils/publish-result.utils";
import { isPureRepostSourcePost } from "~/features/posts/utils/repost-chain-policy";
import {
  buildPostThreadRows,
  filterPostsBySearchWithThreads,
  selectableRootIdsFromPostRows,
} from "~/features/posts/utils/thread-list-grouping";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useInfiniteScrollSentinel } from "~/lib/hooks/useInfiniteScrollSentinel";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import {
  extractPostData,
  extractLongFormPostData,
} from "~/lib/validation/combined-content";

import type { BulkComposerPayload } from "../hooks/usePublishedPosts";
import { usePublishedPosts } from "../hooks/usePublishedPosts";
import {
  usePublishedPostsInfiniteData,
  useBulkDeletePostsMutation,
} from "../hooks/usePublishedPostsQuery";
import { sortPublishedPosts } from "../utils/published-posts-sort";

import PublishedPostsTable from "./PublishedPostsTable";

/* eslint-disable sonarjs/cognitive-complexity -- Page orchestrator: tabs, queue filters, table/list content, modals */
export default function PublishedPostsPage() {
  const refreshPostViews = useRefreshPostViews();
  // Use infinite query for data fetching with infinite scroll
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    stats: initialStats,
    loadedPages,
    totalContentCount,
    totalPostsCount,
    totalRepostsCount,
    totalFollowUpsCount,
    totalLongformCount,
    isLoading: _isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = usePublishedPostsInfiniteData();

  const _params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [modalPostId, setModalPostId] = useState<string | null>(null);
  const [modalPost, setModalPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
  } | null>(null);
  const [modalLongFormPost, setModalLongFormPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
  } | null>(null);
  const [scheduleRepostQuote, setScheduleRepostQuote] = useState<{
    post: PostData;
    mode: "repost" | "quote";
  } | null>(null);
  const [bulkComposer, setBulkComposer] = useState<{
    open: boolean;
    mode: BulkComposerPayload["mode"];
    initialPosts: BulkPost[];
    pendingScheduledRepostData?: unknown[];
  } | null>(null);

  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const dateRange = { from: dateFrom, to: dateTo };
  const setDateRange = useCallback(
    (range: { from: string; to: string }) => {
      const next = new URLSearchParams(searchParams);
      if (range.from) next.set("dateFrom", range.from);
      else next.delete("dateFrom");
      if (range.to) next.set("dateTo", range.to);
      else next.delete("dateTo");
      next.delete("page");
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  usePostResultFromUrl({
    paramName: "published",
    searchParams,
    setSearchParams,
    user,
    modalPostId,
    showPublishModal,
    setModalPostId,
    setModalPost,
    setModalLongFormPost,
    setShowPublishModal,
  });

  const isMobile = useIsMobile(768);
  const fetchNextPageRef = useRef(fetchNextPage);
  useEffect(() => {
    fetchNextPageRef.current = fetchNextPage;
  }, [fetchNextPage]);
  const stableFetchNextPage = useCallback(() => {
    void fetchNextPageRef.current();
  }, []);
  const { sentinelRef, prefetchSentinelRef, setScrollRoot } =
    useInfiniteScrollSentinel({
      isMobile,
      hasNextPage,
      isFetchingNextPage,
      isFetching,
      loadedPageCount: loadedPages,
      fetchNextPage: stableFetchNextPage,
    });

  // Fetch stats client-side after page load (non-blocking)
  const { stats: fetchedStats } = usePostStatsQuery(posts, {
    longFormPosts: longformPosts,
  });

  // Merge initial stats (empty) with fetched stats
  const stats = useMemo<Record<string, PostStats>>(() => {
    const initial: Record<string, PostStats> =
      typeof initialStats === "object" && !Array.isArray(initialStats)
        ? (initialStats as Record<string, PostStats>)
        : {};
    return { ...initial, ...fetchedStats };
  }, [initialStats, fetchedStats]);

  // Use TanStack Query mutation for bulk delete with optimistic updates
  const bulkDeleteMutation = useBulkDeletePostsMutation();

  const onOpenBulkComposer = useCallback((payload: BulkComposerPayload) => {
    if (payload.mode === "repost") {
      setBulkComposer({
        open: true,
        mode: "repost",
        initialPosts: [],
        pendingScheduledRepostData: payload.scheduledRepostData,
      });
    } else {
      setBulkComposer({
        open: true,
        mode: payload.mode,
        initialPosts: payload.initialPosts,
      });
    }
  }, []);

  // Load scheduled repost data when modal opens with pending data
  useEffect(() => {
    if (
      !bulkComposer?.open ||
      bulkComposer.mode !== "repost" ||
      !bulkComposer.pendingScheduledRepostData?.length
    ) {
      return;
    }
    const data = bulkComposer.pendingScheduledRepostData;
    void (async () => {
      const posts = await loadScheduledRepostDataAsBulkPosts(
        data as Parameters<typeof loadScheduledRepostDataAsBulkPosts>[0]
      );
      setBulkComposer((prev) =>
        prev
          ? {
              ...prev,
              initialPosts: posts,
              pendingScheduledRepostData: undefined,
            }
          : null
      );
    })();
  }, [
    bulkComposer?.open,
    bulkComposer?.mode,
    bulkComposer?.pendingScheduledRepostData,
  ]);

  // Call hook unconditionally - hooks must be called at the top level
  const {
    currentTab,
    sortConfig,
    setSortConfig,
    searchTerm,
    setSearchTerm,
    selectedPost,
    selectedPosts,
    selectedLongFormPost,
    setSelectedPost,
    setSelectedLongFormPost,
    toast,
    setToast,
    deleteFetcher,
    bulkDeleteFetcher,
    repostFetcher,
    individualRepostFetcher,
    longformRepostFetcher,
    longformQuoteFetcher,
    requestSort,
    togglePostSelection,
    setSelectedPosts,
    handleBulkDelete: originalHandleBulkDelete,
    handleBulkRepost,
    handleBulkScheduledRepost,
    handleBulkQuote,
    optimisticallyRemovePublishedItems,
  } = usePublishedPosts({
    user,
    allContent,
    posts,
    onOpenBulkComposer,
  });

  // Memoize sorted posts to prevent unnecessary re-sorting on every render
  // Must be called before any early returns to follow React Hooks rules
  const sortedPosts = useMemo(() => {
    return sortPublishedPosts(
      posts,
      sortConfig,
      stats as Record<string, unknown> | undefined
    );
  }, [posts, sortConfig, stats]);

  // Memoize filtered posts by tab (Posts = original only, Reposts = repost only) and search
  const filteredPosts = useMemo(() => {
    const byTab =
      currentTab === "posts"
        ? sortedPosts.filter(
            (p) => !isRepostPost(p) && !isAttachedFollowUpPost(p)
          )
        : currentTab === "reposts"
          ? sortedPosts.filter((p) => isStandaloneRepostPost(p))
          : currentTab === "followups"
            ? sortedPosts.filter((p) => isAttachedFollowUpPost(p))
            : sortedPosts;
    return filterPostsBySearchWithThreads(byTab, searchTerm);
  }, [sortedPosts, searchTerm, currentTab]);

  const publishedSelectableIds = useMemo(
    () =>
      currentTab === "followups"
        ? filteredPosts.map((post) => post.id)
        : selectableRootIdsFromPostRows(
            buildPostThreadRows(filteredPosts, "published")
          ),
    [filteredPosts, currentTab]
  );

  const publishedMixedSelectableIds = useMemo(
    () =>
      getSelectableRootIdsForMixedListing(allContent, "published", searchTerm),
    [allContent, searchTerm]
  );

  const togglePublishedPostsSelectAll = useCallback(() => {
    if (
      publishedSelectableIds.length > 0 &&
      publishedSelectableIds.every((id) => selectedPosts.has(id)) &&
      selectedPosts.size === publishedSelectableIds.length
    ) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(publishedSelectableIds));
    }
  }, [publishedSelectableIds, selectedPosts, setSelectedPosts]);

  const togglePublishedMixedSelectAll = useCallback(() => {
    if (
      publishedMixedSelectableIds.length > 0 &&
      publishedMixedSelectableIds.every((id) => selectedPosts.has(id)) &&
      selectedPosts.size === publishedMixedSelectableIds.length
    ) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(publishedMixedSelectableIds));
    }
  }, [publishedMixedSelectableIds, selectedPosts, setSelectedPosts]);

  const selectionBlocksRepostQuoteChain = useMemo(() => {
    const selected = allContent.filter((item) => selectedPosts.has(item.id));
    return selected.some((item) => isPureRepostSourceContent(item));
  }, [allContent, selectedPosts]);

  const selectionBlocksRepostQuoteChainTab = useMemo(() => {
    const selected = filteredPosts.filter((p) => selectedPosts.has(p.id));
    return selected.some((p) => isPureRepostSourcePost(p));
  }, [filteredPosts, selectedPosts]);

  const selectedPostModalStats = useMemo(() => {
    if (!selectedPost || typeof selectedPost !== "object") return;
    if (!("signedEvent" in selectedPost)) return;
    const se = selectedPost.signedEvent;
    if (
      !se ||
      typeof se !== "object" ||
      !("id" in se) ||
      typeof (se as { id: unknown }).id !== "string"
    ) {
      return;
    }
    const entry = stats[se.id];
    if (!entry) return;
    return {
      likes: entry.likes,
      replies: entry.replies,
      mentions: entry.mentions,
      reposts: entry.reposts,
      zaps: entry.zaps,
      satszapped: entry.satszapped,
    };
  }, [selectedPost, stats]);

  const selectedLongFormModalStats = useMemo(() => {
    if (!selectedLongFormPost) return;
    const eventId = getLongFormPublishedEventId(selectedLongFormPost);
    if (!eventId) return;
    const entry = stats[eventId];
    if (!entry) return;
    return {
      likes: entry.likes,
      replies: entry.replies,
      mentions: entry.mentions,
      reposts: entry.reposts,
      zaps: entry.zaps,
      satszapped: entry.satszapped,
    };
  }, [selectedLongFormPost, stats]);

  // Call hook before any conditional returns
  const { userTimezone, userTimeFormat } = useFormattedDate();

  const resetListFilters = useCallback(() => {
    setSearchTerm("");
    setDateRange({ from: "", to: "" });
    const next = new URLSearchParams(searchParams);
    next.set("tab", "all");
    next.delete("queueType");
    next.delete("dateFrom");
    next.delete("dateTo");
    next.delete("page");
    setSearchParams(next);
  }, [searchParams, setSearchParams, setSearchTerm, setDateRange]);

  const showQueueOnPublished =
    currentTab === "all" ||
    currentTab === "posts" ||
    currentTab === "reposts" ||
    currentTab === "followups" ||
    currentTab === "longform";

  // Handle nullable user - if user is null, we should not render the component
  if (!user) {
    return (
      <div className="text-danger p-4 text-center">
        Error: User data not available. Please refresh the page.
      </div>
    );
  }

  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;
    const postIds = Array.from(selectedPosts);
    const mixedItemData =
      currentTab === "all"
        ? allContent
            .filter((item) => selectedPosts.has(item.id))
            .map((item) => ({ id: item.id, type: item.type }))
        : undefined;

    bulkDeleteMutation.mutate(
      { postIds, mixedItemData },
      {
        onSuccess: () => {
          setSelectedPosts(new Set());
          refreshPostViews();
        },
        onError: () => {
          originalHandleBulkDelete();
        },
      }
    );
  };

  return (
    <PublishingLibraryShell>
      <div className="pt-2 pb-4">
        <PublishingPageHeader
          title="Published"
          subtitle="Review published content, queue history, and recyclable posts."
          actions={<PublishingArchiveModeLinks active="published" />}
        />
      </div>

      <PublishingFilterRow>
        <FilterToolbarRow
          typeControl={
            <PublishingLibraryContentSegments
              basePath="/dashboard/published"
              currentTab={currentTab}
              totalContentCount={totalContentCount}
              totalPostsCount={totalPostsCount}
              totalRepostsCount={totalRepostsCount}
              totalFollowUpsCount={totalFollowUpsCount}
              totalLongformCount={totalLongformCount}
              data-testid="published-type-segments"
            />
          }
          queueControl={
            showQueueOnPublished ? (
              <PublishingQueueFilter
                currentTab={currentTab}
                queueTypes={queueTypes}
                basePath="/dashboard/published"
              />
            ) : null
          }
          dateControls={
            <FilterDateRangeControls
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              idPrefix="published"
              maxDate={getTodayInTimezone(userTimezone)}
              userDateFormat={
                user.dateFormat === "mmddyyyy"
                  ? "mmddyyyy"
                  : user.dateFormat === "yyyymmdd"
                    ? "yyyymmdd"
                    : "ddmmyyyy"
              }
            />
          }
          presetControls={
            <DateRangeQuickPresets
              variant="past"
              userTimezone={userTimezone}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          }
        />
      </PublishingFilterRow>

      <div className="flex min-h-0 flex-1 flex-col">
        {currentTab === "all" ? (
          <AllContentListing
            content={allContent}
            type="published"
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            userTimezone={user.timezone ?? undefined}
            userTimeFormat={userTimeFormat}
            onPostSelect={(content) => {
              if (content.type === "post") {
                const postData = extractPostData(content);
                if (postData) {
                  setSelectedPost(postData);
                }
              } else {
                const longFormData = extractLongFormPostData(content);
                if (longFormData) {
                  setSelectedLongFormPost(longFormData);
                }
              }
            }}
            selectedItems={selectedPosts}
            onToggleSelection={togglePostSelection}
            onToggleSelectAll={togglePublishedMixedSelectAll}
            showBulkActions={true}
            onClearSelection={() => setSelectedPosts(new Set())}
            onBulkDelete={handleBulkDelete}
            bulkDeleteState={
              bulkDeleteMutation.isPending
                ? "submitting"
                : bulkDeleteFetcher.state
            }
            individualRepostFetcher={individualRepostFetcher}
            longformRepostFetcher={longformRepostFetcher}
            longformQuoteFetcher={longformQuoteFetcher}
            onBulkRepost={
              selectionBlocksRepostQuoteChain ? undefined : handleBulkRepost
            }
            onBulkScheduledRepost={
              selectionBlocksRepostQuoteChain
                ? undefined
                : handleBulkScheduledRepost
            }
            onBulkQuote={
              selectionBlocksRepostQuoteChain ? undefined : handleBulkQuote
            }
            repostFetcher={repostFetcher as PostFetcher}
            onScheduleRepost={(post) =>
              setScheduleRepostQuote({ post, mode: "repost" })
            }
            onScheduleQuote={(post) =>
              setScheduleRepostQuote({ post, mode: "quote" })
            }
            prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
            sentinelRef={isMobile ? sentinelRef : undefined}
            isFetchingNextPage={isFetchingNextPage}
            onScrollContainerReady={isMobile ? setScrollRoot : undefined}
            onResetListFilters={resetListFilters}
            onBeforeDelete={(postId) =>
              optimisticallyRemovePublishedItems([postId])
            }
          />
        ) : currentTab === "posts" ||
          currentTab === "reposts" ||
          currentTab === "followups" ? (
          <>
            <ContentBulkActions
              type="published"
              selectedCount={selectedPosts.size}
              onClearSelection={() => setSelectedPosts(new Set())}
              onBulkDelete={handleBulkDelete}
              bulkDeleteState={
                bulkDeleteMutation.isPending
                  ? "submitting"
                  : bulkDeleteFetcher.state
              }
              onBulkRepost={
                selectionBlocksRepostQuoteChainTab
                  ? undefined
                  : handleBulkRepost
              }
              onBulkScheduledRepost={
                selectionBlocksRepostQuoteChainTab
                  ? undefined
                  : handleBulkScheduledRepost
              }
              onBulkQuote={
                selectionBlocksRepostQuoteChainTab ? undefined : handleBulkQuote
              }
              repostFetcher={repostFetcher as PostFetcher}
            />
            <PublishedPostsTable
              filteredPosts={filteredPosts}
              selectedPosts={selectedPosts}
              stats={stats}
              sortConfig={sortConfig}
              selectableRootIds={publishedSelectableIds}
              toggleSelectAll={togglePublishedPostsSelectAll}
              togglePostSelection={togglePostSelection}
              requestSort={requestSort}
              setSelectedPost={setSelectedPost}
              individualRepostFetcher={individualRepostFetcher}
              deleteFetcher={deleteFetcher}
              bulkDeleteFetcher={bulkDeleteFetcher}
              userTimezone={user.timezone ?? undefined}
              userTimeFormat={userTimeFormat}
              onScheduleRepost={(post: PostData) =>
                setScheduleRepostQuote({ post, mode: "repost" })
              }
              onScheduleQuote={(post: PostData) =>
                setScheduleRepostQuote({ post, mode: "quote" })
              }
              onSortChange={(key: string, direction: "asc" | "desc") =>
                setSortConfig({ key, direction })
              }
              prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
              sentinelRef={isMobile ? sentinelRef : undefined}
              isFetchingNextPage={isFetchingNextPage}
              onScrollContainerReady={isMobile ? setScrollRoot : undefined}
              onBeforeDelete={(postId) =>
                optimisticallyRemovePublishedItems([postId])
              }
              showFollowUpsAsRows={currentTab === "followups"}
            />
          </>
        ) : (
          <LongFormListing
            posts={longformPosts}
            type="published"
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            userTimezone={user.timezone ?? undefined}
            userTimeFormat={userTimeFormat}
            longformRepostFetcher={longformRepostFetcher}
            longformQuoteFetcher={longformQuoteFetcher}
            onPostSelect={(post) => {
              setSelectedLongFormPost(post as LongFormPostData);
            }}
            prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
            sentinelRef={isMobile ? sentinelRef : undefined}
            isFetchingNextPage={isFetchingNextPage}
            onScrollContainerReady={isMobile ? setScrollRoot : undefined}
          />
        )}
        {/* Scroll sentinel for infinite scroll (desktop); on mobile sentinels are inside listing scroll container */}
        {!isMobile ? (
          <>
            <div ref={prefetchSentinelRef} className="h-4 w-full shrink-0" />
            <div ref={sentinelRef} className="h-4 w-full shrink-0" />
            {isFetchingNextPage ? (
              <div className="text-text-secondary mt-4 text-center text-sm">
                Loading more posts...
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost}
          stats={selectedPostModalStats}
          onClose={() => setSelectedPost(null)}
          onDeleted={(postId) => {
            optimisticallyRemovePublishedItems([postId]);
            refreshPostViews();
          }}
          type="published"
          showStats={true}
          showSignedEvent={true}
          userTimezone={user.timezone ?? undefined}
          userTimeFormat={userTimeFormat}
        />
      ) : null}

      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          stats={selectedLongFormModalStats}
          onClose={() => setSelectedLongFormPost(null)}
          onDeleted={(postId) => {
            optimisticallyRemovePublishedItems([postId]);
            refreshPostViews();
          }}
          type="published"
          showStats={true}
          showSignedEvent={true}
          userTimezone={user.timezone ?? undefined}
          userTimeFormat={userTimeFormat}
        />
      ) : null}

      {scheduleRepostQuote ? (
        <ScheduleRepostQuoteModal
          key={`schedule-repost-quote-${scheduleRepostQuote.post.id}-${scheduleRepostQuote.mode}`}
          open={true}
          post={scheduleRepostQuote.post}
          mode={scheduleRepostQuote.mode}
          onClose={() => setScheduleRepostQuote(null)}
          onSuccess={() => setScheduleRepostQuote(null)}
          user={user}
        />
      ) : null}

      {bulkComposer?.open ? (
        <BulkComposerModal
          open={true}
          onClose={() => setBulkComposer(null)}
          onSuccess={() => setBulkComposer(null)}
          mode={bulkComposer.mode}
          initialPosts={bulkComposer.initialPosts}
          user={user}
        />
      ) : null}

      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}

      {showPublishModal && modalPostId && (modalPost || modalLongFormPost) ? (
        <PublishResultModal
          isOpen={showPublishModal}
          postId={modalPostId}
          publishAttemptId={
            modalPost?.publishAttemptId ??
            modalLongFormPost?.publishAttemptId ??
            null
          }
          action={determineModalAction(modalPost, modalLongFormPost)}
          postType={getPostTypeFromPost(modalPost, modalLongFormPost)}
          onCreateNew={() => {
            const postType = getPostTypeFromPost(modalPost, modalLongFormPost);
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
            navigate(getNewPostUrl(postType));
          }}
          onViewPage={() => {
            setShowPublishModal(false);
            setModalPostId(null);
            setModalPost(null);
            setModalLongFormPost(null);
          }}
        />
      ) : null}
    </PublishingLibraryShell>
  );
}
/* eslint-enable sonarjs/cognitive-complexity */
