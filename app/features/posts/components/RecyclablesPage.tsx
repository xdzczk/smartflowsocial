import { useFetcher, useParams } from "@remix-run/react";
import { useEffect } from "react";

import type { CombinedContent, PostData } from "~/features/posts/server";
import {
  PostDetailsModal,
  RecyclablesBulkActions,
  RecyclablesQueueTabs,
  RecyclablesTable,
  RecyclablesToast,
  useRecyclablesInfiniteData,
  useRecyclablesState,
  type IndividualRepostFetcherData,
} from "~/features/posts/ui";
import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";

interface RepostFetcherData {
  repostData?: unknown;
  scheduledRepostData?: unknown;
  quotePostData?: unknown;
}

export default function RecyclablesPage() {
  // Use infinite query for data fetching with infinite scroll
  const {
    posts: typedPosts,
    stats: typedStats,
    user,
    queueTypes,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useRecyclablesInfiniteData();
  const params = useParams();

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

  const deleteFetcher = useFetcher();
  const bulkDeleteFetcher = useFetcher();
  const repostFetcher = useFetcher<RepostFetcherData>();
  const individualRepostFetcher = useFetcher<IndividualRepostFetcherData>();

  const {
    sortConfig,
    searchTerm: _searchTerm,
    selectedPost,
    selectedPosts,
    toast,
    filteredPosts,
    requestSort,
    setSearchTerm: _setSearchTerm,
    setSelectedPost,
    togglePostSelection,
    toggleSelectAll,
    handleBulkDelete,
    handleBulkRepost,
    handleBulkScheduledRepost,
    handleBulkQuote,
    setToast,
  } = useRecyclablesState({
    posts: typedPosts,
    stats: typedStats,
    user: user ?? null,
    repostFetcher,
    bulkDeleteFetcher,
    bulkRepostFetcher: repostFetcher,
    individualRepostFetcher,
  });

  return (
    <div>
      <div className="mt-5 mb-5">
        <h3 className="mb-1 font-semibold">Recyclable Posts</h3>
      </div>

      <RecyclablesQueueTabs
        queueTypes={queueTypes}
        currentQueueType={params["queueType"]}
      />

      <RecyclablesBulkActions
        selectedCount={selectedPosts.size}
        onBulkRepost={handleBulkRepost}
        onBulkScheduledRepost={handleBulkScheduledRepost}
        onBulkQuote={handleBulkQuote}
        onBulkDelete={handleBulkDelete}
        repostFetcher={repostFetcher}
        bulkDeleteFetcher={bulkDeleteFetcher}
      />

      <RecyclablesTable
        posts={filteredPosts.map(
          (
            post
          ): {
            id: string;
            caption?: string | null;
            postedAt: Date | null;
            fileUrl: string[];
            signedEvent: { id: string };
            queueType?: { name: string; color?: string | null } | null;
            status?: string;
          } => ({
            id: post.id,
            caption: post.caption ?? null,
            postedAt:
              post.postedAt instanceof Date
                ? post.postedAt
                : typeof post.postedAt === "string"
                  ? new Date(post.postedAt)
                  : null,
            fileUrl: Array.isArray(post.fileUrl)
              ? post.fileUrl
              : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: fileUrl may be a string from legacy data
                post.fileUrl
                ? [post.fileUrl]
                : [],
            signedEvent:
              post.signedEvent &&
              typeof post.signedEvent === "object" &&
              "id" in post.signedEvent
                ? { id: String(post.signedEvent.id) }
                : { id: "" },
            queueType: post.queueType
              ? {
                  name: post.queueType.name,
                  color: post.queueType.color ?? null,
                }
              : null,
            status: typeof post.status === "string" ? post.status : undefined,
          })
        )}
        stats={typedStats}
        sortConfig={sortConfig}
        selectedPosts={selectedPosts}
        onRequestSort={requestSort}
        onPostClick={(post) => {
          // Find the original PostData from typedPosts array
          const originalPostData = typedPosts.find((p) => p.id === post.id);
          if (originalPostData) {
            // Convert to the Post format expected by useRecyclablesState
            setSelectedPost({
              ...originalPostData,
              postedAt:
                originalPostData.postedAt instanceof Date
                  ? originalPostData.postedAt
                  : typeof originalPostData.postedAt === "string"
                    ? new Date(originalPostData.postedAt)
                    : null,
              fileUrl: Array.isArray(originalPostData.fileUrl)
                ? originalPostData.fileUrl
                : typeof originalPostData.fileUrl === "string"
                  ? [originalPostData.fileUrl]
                  : [],
              signedEvent:
                originalPostData.signedEvent &&
                typeof originalPostData.signedEvent === "object" &&
                "id" in originalPostData.signedEvent
                  ? { id: String(originalPostData.signedEvent.id) }
                  : { id: "" },
            });
          }
        }}
        onToggleSelect={togglePostSelection}
        onToggleSelectAll={toggleSelectAll}
        deleteFetcher={deleteFetcher}
        individualRepostFetcher={individualRepostFetcher}
        bulkDeleteFetcher={bulkDeleteFetcher}
      />

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

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost as unknown as PostData | CombinedContent}
          stats={(() => {
            const eventId =
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: type narrowing for serialized data
              selectedPost &&
              typeof selectedPost === "object" &&
              "signedEvent" in selectedPost &&
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: signedEvent may not exist
              selectedPost.signedEvent &&
              typeof selectedPost.signedEvent === "object" &&
              "id" in selectedPost.signedEvent
                ? String((selectedPost.signedEvent as { id?: string }).id)
                : "";
            const statsEntry = typedStats[eventId];
            return statsEntry
              ? {
                  likes: statsEntry.likes ?? 0,
                  replies: statsEntry.replies ?? 0,
                  mentions: statsEntry.mentions ?? 0,
                  reposts: statsEntry.reposts ?? 0,
                  zaps: statsEntry.zaps ?? 0,
                  satszapped: statsEntry.satszapped ?? 0,
                }
              : undefined;
          })()}
          onClose={() => setSelectedPost(null)}
          showStats={true}
          showSignedEvent={true}
          type="posted"
          userTimezone={user?.timezone ?? undefined}
        />
      ) : null}

      <RecyclablesToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
