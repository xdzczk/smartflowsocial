import { useParams, useSearchParams, useNavigate } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import Toast from "~/components/ui/Toast";
import { ContentBulkActions } from "~/features/posts/components/ContentBulkActions";
import { DateRangeQuickPresets } from "~/features/posts/components/DateRangeQuickPresets";
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
  CombinedContent,
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
import { loadScheduledRepostDataAsBulkPosts } from "~/features/posts/utils/bulk-composer-data";
import { isRepostPost } from "~/features/posts/utils/content-helpers";
import { getTodayInTimezone } from "~/features/posts/utils/date-range-filter";
import {
  determineModalAction,
  getNewPostUrl,
  getPostTypeFromPost,
} from "~/features/posts/utils/publish-result.utils";
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
    totalContentCount,
    totalPostsCount,
    totalRepostsCount,
    totalLongformCount,
    isLoading: _isLoading,
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
  const { sentinelRef, prefetchSentinelRef, setScrollRoot } =
    useInfiniteScrollSentinel({
      isMobile,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage: () => {
        void fetchNextPage();
      },
    });

  // Fetch stats client-side after page load (non-blocking)
  const { stats: fetchedStats } = usePostStatsQuery(posts);

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
    toggleSelectAll,
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
        ? sortedPosts.filter((p) => !isRepostPost(p))
        : currentTab === "reposts"
          ? sortedPosts.filter((p) => isRepostPost(p))
          : sortedPosts;
    return byTab.filter((post) =>
      post.caption?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedPosts, searchTerm, currentTab]);

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
    currentTab === "longform";

  // Handle nullable user - if user is null, we should not render the component
  if (!user) {
    return (
      <div className="text-destructive p-4 text-center">
        Error: User data not available. Please refresh the page.
      </div>
    );
  }

  // Enhanced bulk delete with optimistic updates
  const handleBulkDelete = () => {
    if (selectedPosts.size === 0) return;
    const postIds = Array.from(selectedPosts);

    bulkDeleteMutation.mutate(postIds, {
      onError: () => {
        originalHandleBulkDelete();
      },
    });
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
            onToggleSelectAll={() =>
              toggleSelectAll(filteredPosts as PostData[] | CombinedContent[])
            }
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
            onBulkRepost={handleBulkRepost}
            onBulkScheduledRepost={handleBulkScheduledRepost}
            onBulkQuote={handleBulkQuote}
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
          />
        ) : currentTab === "posts" || currentTab === "reposts" ? (
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
              onBulkRepost={handleBulkRepost}
              onBulkScheduledRepost={handleBulkScheduledRepost}
              onBulkQuote={handleBulkQuote}
              repostFetcher={repostFetcher as PostFetcher}
            />
            <PublishedPostsTable
              filteredPosts={filteredPosts}
              selectedPosts={selectedPosts}
              stats={stats}
              sortConfig={sortConfig}
              toggleSelectAll={() =>
                toggleSelectAll(filteredPosts as PostData[] | CombinedContent[])
              }
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
              <div className="text-muted-foreground mt-4 text-center text-sm">
                Loading more posts...
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onDeleted={(postId) => {
            optimisticallyRemovePublishedItems([postId]);
            refreshPostViews();
          }}
          type="published"
          showSignedEvent={true}
          userTimezone={user.timezone ?? undefined}
          userTimeFormat={userTimeFormat}
        />
      ) : null}

      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
          onDeleted={(postId) => {
            optimisticallyRemovePublishedItems([postId]);
            refreshPostViews();
          }}
          type="published"
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
