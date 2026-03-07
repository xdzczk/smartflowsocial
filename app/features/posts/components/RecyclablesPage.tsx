import { Link, useFetcher, useParams, useSearchParams } from "@remix-run/react";
import { useEffect, useMemo } from "react";

import { usePostStatsQuery } from "~/features/posts/hooks/usePostStatsQuery";
import type { EngagementFilterOption } from "~/features/posts/hooks/useRecyclablesState";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import type { CombinedContent, PostData } from "~/features/posts/server";
import {
  PostDetailsModal,
  RecyclablesBulkActions,
  RecyclablesQueueFilter,
  RecyclablesTable,
  RecyclablesToast,
  useRecyclablesInfiniteData,
  useRecyclablesState,
  type IndividualRepostFetcherData,
} from "~/features/posts/ui";
import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";

import { getTodayInTimezone } from "../utils/date-range-filter";

import { DateRangeFilter } from "./DateRangeFilter";
import { DateRangeQuickPresets } from "./DateRangeQuickPresets";
import { EngagementFilter } from "./EngagementFilter";
import { OlderThanFilter } from "./OlderThanFilter";

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
  const [searchParams, setSearchParams] = useSearchParams();

  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const dateRange = { from: dateFrom, to: dateTo };
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
  const setDateRange = (range: { from: string; to: string }) => {
    const next = new URLSearchParams(searchParams);
    if (range.from) next.set("dateFrom", range.from);
    else next.delete("dateFrom");
    if (range.to) next.set("dateTo", range.to);
    else next.delete("dateTo");
    setSearchParams(next, { replace: true });
  };

  const userTimezone = user?.timezone?.trim() ?? "UTC";

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
    handleBulkDelete,
    handleBulkRepost,
    handleBulkScheduledRepost,
    handleBulkQuote,
    setToast,
  } = useRecyclablesState({
    posts: typedPosts,
    stats,
    engagementFilter,
    user: user ?? null,
    repostFetcher,
    bulkDeleteFetcher,
    bulkRepostFetcher: repostFetcher,
    individualRepostFetcher,
  });

  return (
    <div>
      <div className="flex flex-shrink-0 flex-row items-center gap-4">
        <h3 className="min-w-0 flex-shrink-0 font-semibold">
          Recyclable Posts
        </h3>
        <nav
          className="bg-muted text-muted-foreground ml-auto inline-flex h-9 flex-shrink-0 items-center justify-center rounded-lg p-1"
          aria-label="Switch between Published and Recyclables view"
        >
          <Link
            to="/dashboard/published"
            prefetch="intent"
            className="hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none"
          >
            Published
          </Link>
          <span
            className="bg-background text-foreground inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap shadow"
            aria-current="page"
          >
            Recyclables
          </span>
        </nav>
      </div>

      <div className="border-border mb-6 flex flex-col items-end gap-2 border-b md:flex-row md:flex-nowrap md:items-center">
        <div className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
          <OlderThanFilter />
          <EngagementFilter />
        </div>
        <div className="flex w-full flex-row flex-nowrap items-center gap-2 md:ml-auto md:w-auto md:flex-shrink-0">
          <DateRangeFilter
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            idPrefix="recyclables"
            className="w-full max-md:w-auto md:w-auto md:flex-shrink-0"
            maxDate={getTodayInTimezone(userTimezone)}
            userDateFormat={
              user?.dateFormat === "mmddyyyy"
                ? "mmddyyyy"
                : user?.dateFormat === "yyyymmdd"
                  ? "yyyymmdd"
                  : "ddmmyyyy"
            }
          />
          <DateRangeQuickPresets
            variant="past"
            userTimezone={userTimezone}
            onDateRangeChange={setDateRange}
          />
          <RecyclablesQueueFilter queueTypes={queueTypes} />
        </div>
      </div>

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
          const originalPostData = typedPosts.find((p) => p.id === post.id);
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
          type="published"
          userTimezone={user?.timezone ?? undefined}
        />
      ) : null}

      <RecyclablesToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
