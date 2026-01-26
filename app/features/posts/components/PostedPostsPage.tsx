import {
  useParams,
  useSearchParams,
  useNavigate,
  useFetcher,
} from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";

import Toast from "~/components/ui/Toast";
import { usePostStatsQuery } from "~/features/posts/hooks/usePostStatsQuery";
import type {
  PostData,
  CombinedContent,
  LongFormPostData,
  PostFetcher,
} from "~/features/posts/server";
import type { PostStats } from "~/features/posts/stats.server";
import {
  AllContentListing,
  LongFormDetailsModal,
  LongFormListing,
  PostedPostsTable,
  PostedPostsTabs,
  usePostedPosts,
  usePostedPostsInfiniteData,
  useBulkDeletePostsMutation,
} from "~/features/posts/ui";
import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";
import {
  extractPostData,
  extractLongFormPostData,
} from "~/lib/validation/combined-content";
import { comparePostDataByProperty } from "~/lib/validation/post-data-properties";
import { getPostStats, getPostStatsValue } from "~/lib/validation/post-stats";

import {
  getPostTypeFromPost,
  getNewPostUrl,
  determineModalAction,
} from "../utils/publish-result.utils";

import PublishResultModal from "./PublishResultModal";

function getDateValue(postedAt: Date | string | null | undefined): number {
  if (postedAt instanceof Date) {
    return postedAt.getTime();
  }
  if (postedAt) {
    return new Date(postedAt).getTime();
  }
  return new Date(0).getTime();
}

function compareByDate(
  a: PostData,
  b: PostData,
  direction: "asc" | "desc"
): number {
  const dateA = getDateValue(a.postedAt);
  const dateB = getDateValue(b.postedAt);
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
    if (sortConfig.key === "postedAt") {
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

export default function PostedPostsPage() {
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
    totalLongformCount,
    isLoading: _isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = usePostedPostsInfiniteData();

  const _params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const postFetcher = useFetcher();
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

  // Check for published URL param
  useEffect(() => {
    const publishedPostId = searchParams.get("published");
    if (publishedPostId && user) {
      // Use setTimeout to avoid setState in effect warning
      setTimeout(() => {
        setModalPostId(publishedPostId);
        // Fetch post data
        postFetcher.load(`/api/posts/${publishedPostId}`);
      }, 0);
    }
  }, [searchParams, user, postFetcher]);

  // Handle post fetcher data
  useEffect(() => {
    if (postFetcher.data && modalPostId) {
      const data = postFetcher.data as {
        post?: {
          id: string;
          publishAttemptId: string | null;
          currentState?: string | null;
        };
        longFormPost?: {
          id: string;
          publishAttemptId: string | null;
          currentState?: string | null;
        };
        error?: string;
      };
      const post = data.post;
      const longFormPost = data.longFormPost;

      if (post || longFormPost) {
        // Use setTimeout to avoid setState in effect warning
        setTimeout(() => {
          setModalPost(post ?? null);
          setModalLongFormPost(longFormPost ?? null);
          setShowPublishModal(true);
          // Clear URL param to prevent re-showing on refresh
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete("published");
          setSearchParams(newSearchParams, { replace: true });
        }, 0);
      }
    }
  }, [postFetcher.data, modalPostId, searchParams, setSearchParams]);

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

  // Call hook unconditionally - hooks must be called at the top level
  const {
    currentTab,
    sortConfig,
    searchTerm,
    setSearchTerm,
    selectedPosts,
    selectedLongFormPost,
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
    setSelectedPost,
  } = usePostedPosts({
    user,
    allContent,
    posts,
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

  // Memoize filtered posts to prevent unnecessary filtering on every render
  const filteredPosts = useMemo(() => {
    return sortedPosts.filter((post) =>
      post.caption?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedPosts, searchTerm]);

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
    <div>
      <div className="mt-5 mb-5 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div>
          <h3 className="mb-1 font-semibold">Posted History</h3>
        </div>
      </div>

      <PostedPostsTabs
        currentTab={currentTab}
        queueTypes={queueTypes.map((qt) => ({
          name: qt.name,
          color: qt.color ?? undefined,
        }))}
        allContentLength={totalContentCount}
        postsLength={totalPostsCount}
        longformPostsLength={totalLongformCount}
      />

      {currentTab === "all" ? (
        <AllContentListing
          content={allContent}
          type="posted"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user.timezone ?? undefined}
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
        />
      ) : currentTab === "posts" ? (
        <PostedPostsTable
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
        />
      ) : (
        <LongFormListing
          posts={longformPosts}
          type="posted"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user.timezone ?? undefined}
          longformRepostFetcher={longformRepostFetcher}
          longformQuoteFetcher={longformQuoteFetcher}
          onPostSelect={(post) => {
            setSelectedLongFormPost(post as LongFormPostData);
          }}
        />
      )}

      {/* Scroll sentinel for infinite scroll */}
      {/* Prefetch sentinel - triggers at 70% to prefetch next page */}
      <div ref={prefetchSentinelRef} className="h-4 w-full" />
      {/* Main sentinel - triggers at 80% to ensure next page is loaded */}
      <div ref={sentinelRef} className="h-4 w-full" />

      {/* Loading indicator for next page */}
      {isFetchingNextPage ? (
        <div className="text-muted-foreground mt-4 text-center text-sm">
          Loading more posts...
        </div>
      ) : null}

      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
          type="posted"
          showSignedEvent={true}
          userTimezone={user.timezone ?? undefined}
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
}
