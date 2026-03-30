import { useFetcher, useParams, useSearchParams } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EngagementFilter } from "~/features/posts/components/EngagementFilter";
import { OlderThanFilter } from "~/features/posts/components/OlderThanFilter";
import {
  BulkComposerModal,
  type BulkComposerUser,
} from "~/features/posts/composer";
import { usePostStatsQuery } from "~/features/posts/hooks/usePostStatsQuery";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import type { CombinedContent, PostData } from "~/features/posts/server";
import type { BulkPost } from "~/features/posts/types";
import {
  PostDetailsModal,
  PublishingArchiveModeLinks,
  PublishingFilterRow,
  PublishingLibraryShell,
  PublishingPageHeader,
} from "~/features/posts/ui";
import { loadScheduledRepostDataAsBulkPosts } from "~/features/posts/utils/bulk-composer-data";
import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";

import type { BulkComposerPayload } from "../hooks/usePublishedPosts";
import { useRecyclablesInfiniteData } from "../hooks/useRecyclablesQuery";
import type {
  EngagementFilterOption,
  IndividualRepostFetcherData,
} from "../hooks/useRecyclablesState";
import { useRecyclablesState } from "../hooks/useRecyclablesState";

import { RecyclablesBulkActions } from "./RecyclablesBulkActions";
import { RecyclablesQueueFilter } from "./RecyclablesQueueFilter";
import { RecyclablesTable } from "./RecyclablesTable";
import { RecyclablesToast } from "./RecyclablesToast";

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
  const _params = useParams();
  const [searchParams] = useSearchParams();

  const engagementType = searchParams.get("engagementType") ?? "";
  const engagementMinStr = searchParams.get("engagementMin") ?? "";
  const engagementMin = Number.isFinite(parseInt(engagementMinStr, 10))
    ? parseInt(engagementMinStr, 10)
    : 0;
  const engagementFilter: EngagementFilterOption | null =
    engagementType &&
    (engagementType === "zaps" ||
      engagementType === "reactions" ||
      engagementType === "replies" ||
      engagementType === "reposts") &&
    engagementMin >= 0
      ? { type: engagementType, min: engagementMin }
      : null;

  const [bulkComposer, setBulkComposer] = useState<{
    open: boolean;
    mode: BulkComposerPayload["mode"];
    initialPosts: BulkPost[];
    pendingScheduledRepostData?: unknown[];
  } | null>(null);

  const onOpenBulkComposer = useCallback(
    (payload: BulkComposerPayload) => {
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
    },
    [setBulkComposer]
  );

  // Load scheduled repost data when modal opens with pending data (repost mode)
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

  const bulkDeleteFetcher = useFetcher();
  const repostFetcher = useFetcher<RepostFetcherData>();
  const individualRepostFetcher = useFetcher<IndividualRepostFetcherData>();

  // Fetch stats client-side after page load (non-blocking), same as Published page
  const { stats: fetchedStats } = usePostStatsQuery(typedPosts);
  const stats = useMemo(
    () => ({ ...typedStats, ...fetchedStats }),
    [typedStats, fetchedStats]
  );

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
    handleBulkDelete: _handleBulkDelete,
    handleBulkRepost,
    handleBulkScheduledRepost: _handleBulkScheduledRepost,
    handleBulkQuote: _handleBulkQuote,
    setToast,
  } = useRecyclablesState({
    posts: typedPosts,
    stats,
    engagementFilter,
    onOpenBulkComposer,
    user: user ?? null,
    repostFetcher,
    bulkDeleteFetcher,
    bulkRepostFetcher: repostFetcher,
    individualRepostFetcher,
  });

  return (
    <PublishingLibraryShell>
      <div className="pt-2 pb-4">
        <PublishingPageHeader
          title="Recyclables"
          subtitle="Reuse high-performing published posts as templates for new content."
          actions={<PublishingArchiveModeLinks active="recyclables" />}
        />
      </div>

      <PublishingFilterRow
        leading={
          <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
            <OlderThanFilter />
            <EngagementFilter />
          </div>
        }
        trailing={<RecyclablesQueueFilter queueTypes={queueTypes} />}
      />

      <RecyclablesBulkActions
        selectedCount={selectedPosts.size}
        onBulkRecycle={handleBulkRepost}
        recycleFetcher={repostFetcher}
      />

      <RecyclablesTable
        posts={filteredPosts.map(
          (
            post
          ): {
            id: string;
            caption?: string | null;
            publishedAt: Date | null;
            fileUrl: string[];
            signedEvent: { id: string };
            queueType?: { name: string; color?: string | null } | null;
            status?: string;
          } => ({
            id: post.id,
            caption: post.caption ?? null,
            publishedAt:
              post.publishedAt instanceof Date
                ? post.publishedAt
                : typeof post.publishedAt === "string"
                  ? new Date(post.publishedAt)
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
                  color: getQueueAccentHex(
                    (post.queueType as { colorToken?: string | null })
                      .colorToken ?? null
                  ),
                }
              : null,
            status: typeof post.status === "string" ? post.status : undefined,
          })
        )}
        stats={stats}
        sortConfig={sortConfig}
        selectedPosts={selectedPosts}
        onRequestSort={requestSort}
        onPostClick={(post) => {
          // Find the original PostData from typedPosts array
          const originalPostData = typedPosts.find(
            (p: PostData) => p.id === post.id
          );
          if (originalPostData) {
            // Convert to the Post format expected by useRecyclablesState
            setSelectedPost({
              ...originalPostData,
              publishedAt:
                originalPostData.publishedAt instanceof Date
                  ? originalPostData.publishedAt
                  : typeof originalPostData.publishedAt === "string"
                    ? new Date(originalPostData.publishedAt)
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
        recycleFetcher={repostFetcher}
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

      {bulkComposer?.open ? (
        <BulkComposerModal
          open={true}
          onClose={() => setBulkComposer(null)}
          onSuccess={() => setBulkComposer(null)}
          mode={bulkComposer.mode}
          initialPosts={bulkComposer.initialPosts}
          user={user as BulkComposerUser | null}
          queueTypes={queueTypes}
        />
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
          type="published"
          userTimezone={user?.timezone ?? undefined}
        />
      ) : null}

      <RecyclablesToast toast={toast} onClose={() => setToast(null)} />
    </PublishingLibraryShell>
  );
}
