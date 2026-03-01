import { useParams, useSearchParams, useNavigate } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import Toast from "~/components/ui/Toast";
import { usePostResultFromUrl } from "~/features/posts/hooks/usePostResultFromUrl";
import { usePostStatsQuery } from "~/features/posts/hooks/usePostStatsQuery";
import { useRefreshPostViews } from "~/features/posts/hooks/useRefreshPostViews";
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
  BulkComposerModal,
  ContentListPageHeader,
  LongFormDetailsModal,
  LongFormListing,
  PostDetailsModal,
  PostTypeTabs,
  PublishedPostsTable,
  QueueSelectionTabs,
  usePublishedPosts,
  usePublishedPostsInfiniteData,
  useBulkDeletePostsMutation,
} from "~/features/posts/ui";
import type { BulkComposerPayload } from "~/features/posts/usePublishedPosts";
import { loadScheduledRepostDataAsBulkPosts } from "~/features/posts/utils/bulk-composer-data";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useInfiniteScrollSentinel } from "~/lib/hooks/useInfiniteScrollSentinel";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import {
  extractPostData,
  extractLongFormPostData,
} from "~/lib/validation/combined-content";
import { comparePostDataByProperty } from "~/lib/validation/post-data-properties";
import { getPostStats, getPostStatsValue } from "~/lib/validation/post-stats";

import { isRepostPost } from "../utils/content-helpers";
import { getTodayInTimezone } from "../utils/date-range-filter";
import {
  getPostTypeFromPost,
  getNewPostUrl,
  determineModalAction,
} from "../utils/publish-result.utils";

import { DateRangeFilter } from "./DateRangeFilter";
import PublishResultModal from "./PublishResultModal";
import { ScheduleRepostQuoteModal } from "./ScheduleRepostQuoteModal";

function getDateValue(publishedAt: Date | string | null | undefined): number {
  if (publishedAt instanceof Date) {
    return publishedAt.getTime();
  }
  if (publishedAt) {
    return new Date(publishedAt).getTime();
  }
  return new Date(0).getTime();
}

function compareByDate(
  a: PostData,
  b: PostData,
  direction: "asc" | "desc"
): number {
  const dateA = getDateValue(a.publishedAt);
  const dateB = getDateValue(b.publishedAt);
  return direction === "asc" ? dateA - dateB : dateB - dateA;
}

function getEventId(post: PostData): string {
  return post.signedEvent &&
    typeof post.signedEvent === "object" &&
    "id" in post.signedEvent &&
    typeof post.signedEvent.id === "string"
    ? post.signedEvent.id
    : "";
}

function compareByEngagementMetric(
  a: PostData,
  b: PostData,
  sortKey: string,
  direction: "asc" | "desc",
  stats: Record<string, unknown> | undefined
): number {
  const aEventId = getEventId(a);
  const bEventId = getEventId(b);

  const aStats = getPostStats(stats, aEventId);
  const bStats = getPostStats(stats, bEventId);
  const aValue = getPostStatsValue(aStats, sortKey);
  const bValue = getPostStatsValue(bStats, sortKey);
  return direction === "asc" ? aValue - bValue : bValue - aValue;
}

function isEngagementMetric(key: string): boolean {
  return [
    "likes",
    "replies",
    "mentions",
    "reposts",
    "zaps",
    "satszapped",
  ].includes(key);
}

function sortPosts(
  posts: PostData[],
  sortConfig: { key: string; direction: "asc" | "desc" },
  stats: Record<string, unknown> | undefined
): PostData[] {
  return [...posts].sort((a, b) => {
    if (sortConfig.key === "publishedAt") {
      return compareByDate(a, b, sortConfig.direction);
    }

    if (isEngagementMetric(sortConfig.key)) {
      return compareByEngagementMetric(
        a,
        b,
        sortConfig.key,
        sortConfig.direction,
        stats
      );
    }

    return comparePostDataByProperty(
      a,
      b,
      sortConfig.key,
      sortConfig.direction
    );
  });
}

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
  const setDateRange = (range: { from: string; to: string }) => {
    const next = new URLSearchParams(searchParams);
    if (range.from) next.set("dateFrom", range.from);
    else next.delete("dateFrom");
    if (range.to) next.set("dateTo", range.to);
    else next.delete("dateTo");
    next.delete("page");
    setSearchParams(next);
  };

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
    return sortPosts(
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
    <div className="flex min-h-screen flex-col">
      <div className="mt-5 mb-5">
        <ContentListPageHeader pageType="published" currentTab={currentTab} />
      </div>

      <div className="border-border mb-6 flex flex-col items-end gap-2 border-b md:flex-row md:flex-nowrap">
        {/* Mobile: content type + queue each 50% width; desktop: participates in single row with order */}
        <div className="flex w-full flex-row flex-nowrap gap-2 md:contents">
          <div className="min-w-0 flex-1 md:order-1">
            <PostTypeTabs
              currentTab={currentTab}
              basePath="/dashboard/published"
              totalContentCount={totalContentCount}
              totalPostsCount={totalPostsCount}
              totalRepostsCount={totalRepostsCount}
              totalLongformCount={totalLongformCount}
              inRow
            />
          </div>
          {currentTab === "all" ||
          currentTab === "posts" ||
          currentTab === "reposts" ||
          currentTab === "longform" ? (
            <div className="min-w-0 flex-1 md:order-3 md:ml-auto md:flex-shrink-0">
              <QueueSelectionTabs
                currentTab={currentTab}
                queueTypes={queueTypes}
                basePath="/dashboard/published"
              />
            </div>
          ) : null}
        </div>
        <div className="flex w-full justify-center md:contents">
          <DateRangeFilter
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            idPrefix="published"
            className="w-full max-md:w-auto md:order-2 md:w-auto md:flex-shrink-0"
            maxDate={getTodayInTimezone(userTimezone)}
          />
        </div>
      </div>

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
          />
        ) : currentTab === "posts" || currentTab === "reposts" ? (
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
            onScheduleRepost={(post) =>
              setScheduleRepostQuote({ post, mode: "repost" })
            }
            onScheduleQuote={(post) =>
              setScheduleRepostQuote({ post, mode: "quote" })
            }
            onSortChange={(key, direction) => setSortConfig({ key, direction })}
            prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
            sentinelRef={isMobile ? sentinelRef : undefined}
            isFetchingNextPage={isFetchingNextPage}
            onScrollContainerReady={isMobile ? setScrollRoot : undefined}
          />
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
    </div>
  );
  /* eslint-enable sonarjs/cognitive-complexity */
}
