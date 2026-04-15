import {
  Link,
  useFetcher,
  useSearchParams,
  useNavigate,
} from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import MediaModal from "~/components/ui/MediaModal";
import { ContentBulkActions } from "~/features/posts/components/ContentBulkActions";
import { DateRangeQuickPresets } from "~/features/posts/components/DateRangeQuickPresets";
import PublishResultModal from "~/features/posts/components/PublishResultModal";
import { BulkComposerModal } from "~/features/posts/composer";
import { usePostResultFromUrl } from "~/features/posts/hooks/usePostResultFromUrl";
import { useRefreshPostViews } from "~/features/posts/hooks/useRefreshPostViews";
import {
  LongFormDetailsModal,
  LongFormListing,
} from "~/features/posts/longform";
import type { BulkComposerPayload } from "~/features/posts/publishing";
import {
  EditScheduledPostModal,
  RescheduleScheduledPostModal,
  ScheduledPostsTable,
  useScheduledState,
  useScheduledPostsInfiniteData,
  scheduledPostsKeys,
} from "~/features/posts/scheduling";
import type { LongFormPostData, PostData } from "~/features/posts/server";
import type { BulkPost, PostFetcher } from "~/features/posts/types";
import {
  AllContentListing,
  PostDetailsModal,
  FilterDateRangeControls,
  FilterToolbarRow,
  PublishingFilterRow,
  PublishingLibraryContentSegments,
  PublishingLibraryShell,
  PublishingPageHeader,
  PublishingQueueFilter,
} from "~/features/posts/ui";
import {
  convertQuoteDataToBulkPosts,
  convertScheduledPostsToBulkPosts,
  loadScheduledRepostDataAsBulkPosts,
} from "~/features/posts/utils/bulk-composer-data";
import { isPureRepostSourceContent } from "~/features/posts/utils/content-helpers";
import { getTodayInTimezone } from "~/features/posts/utils/date-range-filter";
import {
  getPostTypeFromPost,
  getNewPostUrl,
} from "~/features/posts/utils/publish-result.utils";
import { isPureRepostSourcePost } from "~/features/posts/utils/repost-chain-policy";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useInfiniteScrollSentinel } from "~/lib/hooks/useInfiniteScrollSentinel";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import {
  addHours,
  formatForDateTimeLocal,
  nowInTimezone,
} from "~/lib/temporal";
import {
  extractLongFormPostData,
  extractPostData,
} from "~/lib/validation/combined-content";
import { validateUserData } from "~/lib/validation/user-data";

import { pruneScheduledQueryData } from "../hooks/useScheduledPostsCache";

import { ScheduleRepostQuoteModal } from "./ScheduleRepostQuoteModal";

/* eslint-disable sonarjs/cognitive-complexity -- Page orchestrator: tabs, queue filters, table/list content, modals */
export default function ScheduledPostsPage() {
  const refreshPostViews = useRefreshPostViews();
  const queryClient = useQueryClient();
  // Use infinite query for data fetching with infinite scroll
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    hashTagPresets,
    loadedPages,
    totalContentCount,
    totalPostsCount,
    totalRepostsCount,
    totalLongformCount,
    scheduledContestLaunches,
    isLoading: _isDataLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useScheduledPostsInfiniteData();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [modalPostId, setModalPostId] = useState<string | null>(null);
  const [modalPost, setModalPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: Date | null;
  } | null>(null);
  const [modalLongFormPost, setModalLongFormPost] = useState<{
    id: string;
    publishAttemptId: string | null;
    currentState?: string | null;
    scheduledAtUtc?: Date | null;
  } | null>(null);
  const [scheduleRepostQuote, setScheduleRepostQuote] = useState<{
    post: PostData;
    mode: "repost" | "quote";
  } | null>(null);
  const [bulkComposer, setBulkComposer] = useState<{
    open: boolean;
    mode: BulkComposerPayload["mode"] | "reschedule";
    initialPosts: BulkPost[];
    pendingScheduledRepostData?: unknown[];
  } | null>(null);

  const repostFetcher = useFetcher<{
    repostData?: PostData[];
    scheduledRepostData?: PostData[];
    quotePostData?: unknown[];
    longformQuotePostData?: unknown[];
  }>();

  const currentTab = searchParams.get("tab") ?? "all";
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
      next.delete("page"); // reset to first page when changing date range
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  usePostResultFromUrl({
    paramName: "scheduled",
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
      loadedPageCount: loadedPages,
      fetchNextPage: () => {
        void fetchNextPage();
      },
    });

  const {
    sortConfig,
    setSortConfig,
    searchTerm,
    countdowns,
    selectedPost,
    selectedPosts,
    selectedMedia,
    isMediaModalOpen,
    selectedLongFormPost,
    showEditModal,
    showRescheduleModal,
    postToEdit,
    postToReschedule,
    filteredPosts,
    bulkDeleteFetcher,
    deleteFetcher: _deleteFetcher,
    requestSort,
    setSearchTerm,
    setSelectedPost,
    setSelectedPosts,
    setSelectedLongFormPost,
    togglePostSelection,
    toggleSelectAll,
    handleBulkDelete,
    handleMediaClick,
    handleCloseMediaModal,
    handleEditPost,
    handleReschedulePost,
    handleCloseEditModal,
    handleCloseRescheduleModal,
    handleModalSuccess,
  } = useScheduledState({
    scheduledPosts: posts,
    userTimezone: user?.timezone,
    allContent,
    currentTab,
  });

  const { userTimezone, userTimeFormat } = useFormattedDate();

  const handleBulkEditReschedule = useCallback(() => {
    const selected = allContent.filter((item) => selectedPosts.has(item.id));
    const postsOnly = selected.filter((item) => item.type === "post");
    if (postsOnly.length === 0) return;
    const initialPosts = convertScheduledPostsToBulkPosts(
      postsOnly.map((p) => ({
        id: p.id,
        caption: p.caption,
        fileUrl: p.fileUrl,
        queueType: p.queueType,
        scheduledAtUtc: p.scheduledAtUtc,
        isRecyclable: p.isRecyclable,
      })),
      userTimezone || "UTC"
    );
    setBulkComposer({ open: true, mode: "reschedule", initialPosts });
    setSelectedPosts(new Set());
  }, [allContent, selectedPosts, userTimezone, setSelectedPosts]);

  const handleBulkScheduledRepost = useCallback(() => {
    const postIds = allContent
      .filter((item) => selectedPosts.has(item.id) && item.type === "post")
      .map((item) => item.id);
    if (postIds.length === 0) return;
    const formData = new FormData();
    formData.append("_action", "bulkScheduledRepost");
    formData.append("postIds", JSON.stringify(postIds));
    repostFetcher.submit(formData, {
      method: "post",
      action: "/dashboard/published",
    });
  }, [allContent, selectedPosts, repostFetcher]);

  const handleBulkQuote = useCallback(() => {
    const postIds = allContent
      .filter((item) => selectedPosts.has(item.id) && item.type === "post")
      .map((item) => item.id);
    if (postIds.length === 0) return;
    const formData = new FormData();
    formData.append("_action", "bulkQuote");
    formData.append("postIds", JSON.stringify(postIds));
    repostFetcher.submit(formData, {
      method: "post",
      action: "/dashboard/published",
    });
  }, [allContent, selectedPosts, repostFetcher]);

  useEffect(() => {
    if (repostFetcher.data?.scheduledRepostData) {
      const data = repostFetcher.data
        .scheduledRepostData as unknown as PostData[];
      if (data.length === 0) return;
      const tz = user?.timezone ?? "UTC";
      const scheduledRepostData = data.map((post, index: number) => {
        const now = nowInTimezone(tz);
        const baseTime = addHours(now, 1);
        const scheduleZoned = addHours(baseTime, index);
        const scheduledFor = formatForDateTimeLocal(scheduleZoned, tz);
        const qt = post.queueType;
        const queueType =
          typeof qt === "string"
            ? qt
            : ((qt && typeof qt === "object" && "name" in qt
                ? (qt as { name?: string }).name
                : null) ?? "unassigned");
        return {
          caption: "",
          fileUrl: "",
          queueType,
          scheduledFor,
          originalPostId: post.id,
          originalEventId: post.signedEvent?.id,
          originalEventPubkey: post.signedEvent?.pubkey,
          isKind6Repost: true,
        };
      });
      queueMicrotask(() => {
        setBulkComposer({
          open: true,
          mode: "repost",
          initialPosts: [],
          pendingScheduledRepostData: scheduledRepostData,
        });
        setSelectedPosts(new Set());
      });
    }
    if (repostFetcher.data?.quotePostData) {
      const quoteData = repostFetcher.data.quotePostData;
      if (quoteData.length === 0) return;
      const initialPosts = convertQuoteDataToBulkPosts(
        quoteData as Parameters<typeof convertQuoteDataToBulkPosts>[0]
      );
      queueMicrotask(() => {
        setBulkComposer({ open: true, mode: "quote", initialPosts });
        setSelectedPosts(new Set());
      });
    }
    if (repostFetcher.data?.longformQuotePostData) {
      const quoteData = repostFetcher.data.longformQuotePostData;
      const initialPosts = convertQuoteDataToBulkPosts(
        quoteData as Parameters<typeof convertQuoteDataToBulkPosts>[0]
      );
      queueMicrotask(() => {
        setBulkComposer({ open: true, mode: "quote", initialPosts });
        setSelectedPosts(new Set());
      });
    }
  }, [repostFetcher.data, user?.timezone, setSelectedPosts]);

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

  const selectionBlocksRepostQuoteChain = useMemo(() => {
    if (currentTab === "all") {
      return allContent
        .filter((item) => selectedPosts.has(item.id))
        .some((item) => isPureRepostSourceContent(item));
    }
    if (currentTab === "posts" || currentTab === "reposts") {
      return filteredPosts
        .filter((p) => selectedPosts.has(p.id))
        .some((p) => isPureRepostSourcePost(p));
    }
    return false;
  }, [currentTab, allContent, selectedPosts, filteredPosts]);

  const showQueueOnScheduled =
    currentTab === "all" ||
    currentTab === "posts" ||
    currentTab === "reposts" ||
    currentTab === "longform";

  const optimisticallyRemoveScheduledItems = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const deletedIds = new Set(ids);
      queryClient.setQueriesData({ queryKey: scheduledPostsKeys.all }, (old) =>
        pruneScheduledQueryData(old, deletedIds)
      );
    },
    [queryClient]
  );

  return (
    <PublishingLibraryShell>
      <div className="pt-2 pb-4">
        <PublishingPageHeader
          title="Scheduled"
          subtitle="Manage upcoming posts, replies, reposts, articles, and queued publishing."
        />
      </div>

      <PublishingFilterRow>
        <FilterToolbarRow
          typeControl={
            <PublishingLibraryContentSegments
              basePath="/dashboard/scheduled"
              currentTab={currentTab}
              totalContentCount={totalContentCount}
              totalPostsCount={totalPostsCount}
              totalRepostsCount={totalRepostsCount}
              totalLongformCount={totalLongformCount}
              data-testid="scheduled-type-segments"
            />
          }
          queueControl={
            showQueueOnScheduled ? (
              <PublishingQueueFilter
                currentTab={currentTab}
                queueTypes={queueTypes}
                basePath="/dashboard/scheduled"
              />
            ) : null
          }
          dateControls={
            <FilterDateRangeControls
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              idPrefix="scheduled"
              minDate={getTodayInTimezone(userTimezone)}
              userDateFormat={
                user?.dateFormat === "mmddyyyy"
                  ? "mmddyyyy"
                  : user?.dateFormat === "yyyymmdd"
                    ? "yyyymmdd"
                    : "ddmmyyyy"
              }
            />
          }
          presetControls={
            <DateRangeQuickPresets
              variant="future"
              userTimezone={userTimezone}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          }
        />
      </PublishingFilterRow>

      <div className="flex min-h-0 flex-1 flex-col">
        {currentTab === "all" && scheduledContestLaunches.length > 0 ? (
          <div className="border-border bg-muted/20 mb-4 rounded-lg border px-3 py-2 text-sm">
            <p className="text-foreground font-medium">
              Scheduled contest launches
            </p>
            <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
              {scheduledContestLaunches.map((row) => {
                const when = row.scheduledFor
                  ? new Date(row.scheduledFor).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "—";
                const state =
                  row.contestActivationStatus === "failed" ||
                  row.contestActivationStatus === "blocked_by_source_failure"
                    ? "Needs attention"
                    : "Awaiting activation";
                return (
                  <li key={row.id}>
                    <Link
                      to={`/dashboard/contests/detail/${row.contestId}`}
                      className="text-primary font-medium underline-offset-2 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      · {when} · {state}
                      {row.sourceMode === "new_post"
                        ? " · Source: new post"
                        : " · Source: existing post"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {/* Content based on current tab */}
        {currentTab === "all" ? (
          <AllContentListing
            content={allContent}
            type="scheduled"
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            userTimezone={userTimezone}
            userTimeFormat={userTimeFormat}
            onPostSelect={(content) => {
              // Use type guards for safe type narrowing
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
            onToggleSelectAll={toggleSelectAll}
            showBulkActions={true}
            onClearSelection={() => setSelectedPosts(new Set())}
            onBulkDelete={handleBulkDelete}
            bulkDeleteState={bulkDeleteFetcher.state}
            onBulkEditReschedule={handleBulkEditReschedule}
            onBulkScheduledRepost={
              selectionBlocksRepostQuoteChain
                ? undefined
                : handleBulkScheduledRepost
            }
            onBulkQuote={
              selectionBlocksRepostQuoteChain ? undefined : handleBulkQuote
            }
            repostFetcher={repostFetcher as PostFetcher}
            onEditPost={handleEditPost}
            onReschedulePost={handleReschedulePost}
            onScheduleRepost={(p) =>
              setScheduleRepostQuote({
                post: p,
                mode: "repost",
              })
            }
            onScheduleQuote={(p) =>
              setScheduleRepostQuote({
                post: p,
                mode: "quote",
              })
            }
            prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
            sentinelRef={isMobile ? sentinelRef : undefined}
            isFetchingNextPage={isFetchingNextPage}
            onScrollContainerReady={isMobile ? setScrollRoot : undefined}
            onResetListFilters={resetListFilters}
          />
        ) : currentTab === "posts" || currentTab === "reposts" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <ContentBulkActions
              type="scheduled"
              selectedCount={selectedPosts.size}
              onClearSelection={() => setSelectedPosts(new Set())}
              onBulkDelete={handleBulkDelete}
              bulkDeleteState={bulkDeleteFetcher.state}
              onBulkEditReschedule={handleBulkEditReschedule}
              onBulkScheduledRepost={
                selectionBlocksRepostQuoteChain
                  ? undefined
                  : handleBulkScheduledRepost
              }
              onBulkQuote={
                selectionBlocksRepostQuoteChain ? undefined : handleBulkQuote
              }
              repostFetcher={repostFetcher as PostFetcher}
            />

            <ScheduledPostsTable
              posts={filteredPosts}
              sortConfig={sortConfig}
              onRequestSort={requestSort}
              selectedPosts={selectedPosts}
              onToggleSelection={togglePostSelection}
              onToggleSelectAll={toggleSelectAll}
              countdowns={countdowns}
              userTimezone={userTimezone}
              userTimeFormat={userTimeFormat}
              onPostClick={(post) => setSelectedPost(post)}
              onEditPost={(post) =>
                handleEditPost(post as PostData | LongFormPostData)
              }
              onReschedulePost={(post) =>
                handleReschedulePost(post as PostData | LongFormPostData)
              }
              onMediaClick={handleMediaClick}
              bulkDeleteState={bulkDeleteFetcher.state}
              onScheduleRepost={(post) =>
                setScheduleRepostQuote({ post, mode: "repost" })
              }
              onScheduleQuote={(post) =>
                setScheduleRepostQuote({ post, mode: "quote" })
              }
              onSortChange={(key, direction) =>
                setSortConfig({ key, direction })
              }
              prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
              sentinelRef={isMobile ? sentinelRef : undefined}
              isFetchingNextPage={isFetchingNextPage}
              onScrollContainerReady={isMobile ? setScrollRoot : undefined}
            />
          </div>
        ) : (
          <LongFormListing
            posts={longformPosts}
            type="scheduled"
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            userTimezone={userTimezone}
            userTimeFormat={userTimeFormat}
            onPostSelect={(post) => {
              setSelectedLongFormPost(post as LongFormPostData);
            }}
            onEditPost={(post) =>
              handleEditPost(post as PostData | LongFormPostData)
            }
            onReschedulePost={(post) =>
              handleReschedulePost(post as PostData | LongFormPostData)
            }
            prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
            sentinelRef={isMobile ? sentinelRef : undefined}
            isFetchingNextPage={isFetchingNextPage}
            onScrollContainerReady={isMobile ? setScrollRoot : undefined}
          />
        )}
      </div>

      {/* Scroll sentinel for infinite scroll (desktop only; on mobile sentinels are inside listing scroll container) */}
      {!isMobile ? (
        <>
          <div ref={prefetchSentinelRef} className="h-4 w-full" />
          <div ref={sentinelRef} className="h-4 w-full" />
          {isFetchingNextPage ? (
            <div className="text-muted-foreground mt-4 text-center text-sm">
              Loading more posts...
            </div>
          ) : null}
        </>
      ) : null}

      {/* Post Details Modal (rendered at page level so it opens from any tab) */}
      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onDeleted={(postId) => {
            optimisticallyRemoveScheduledItems([postId]);
            refreshPostViews();
          }}
          onEdit={(p) => {
            setSelectedPost(null);
            handleEditPost(p as PostData | LongFormPostData);
          }}
          onReschedule={(p) => {
            setSelectedPost(null);
            handleReschedulePost(p as PostData | LongFormPostData);
          }}
          showSignedEvent={true}
          type="scheduled"
          userTimezone={userTimezone}
          userTimeFormat={userTimeFormat}
        />
      ) : null}

      {/* Media Modal */}
      {selectedMedia ? (
        <MediaModal
          src={selectedMedia}
          alt="Post media"
          isOpen={isMediaModalOpen}
          onClose={handleCloseMediaModal}
        />
      ) : null}

      {/* Long Form Post Details Modal */}
      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
          onDeleted={(postId) => {
            optimisticallyRemoveScheduledItems([postId]);
            refreshPostViews();
          }}
          onEdit={(p) => {
            setSelectedLongFormPost(null);
            handleEditPost(p as PostData | LongFormPostData);
          }}
          onReschedule={(p) => {
            setSelectedLongFormPost(null);
            handleReschedulePost(p as PostData | LongFormPostData);
          }}
          type="scheduled"
          showSignedEvent={true}
          userTimezone={userTimezone}
          userTimeFormat={userTimeFormat}
        />
      ) : null}

      {/* Edit Post Modal */}
      {showEditModal && postToEdit ? (
        <EditScheduledPostModal
          post={postToEdit}
          onClose={handleCloseEditModal}
          onConfirm={handleModalSuccess}
          user={user ? (validateUserData(user) ?? undefined) : undefined}
          queueTypes={queueTypes}
          hashTagPresets={
            Array.isArray(hashTagPresets)
              ? (hashTagPresets as Array<{
                  id: string;
                  name: string;
                  tags: string;
                  description?: string | null;
                }>)
              : []
          }
        />
      ) : null}

      {/* Reschedule Post Modal */}
      {showRescheduleModal && postToReschedule ? (
        <RescheduleScheduledPostModal
          post={postToReschedule}
          onClose={handleCloseRescheduleModal}
          onSuccess={() => {
            handleCloseRescheduleModal();
            handleModalSuccess();
          }}
          user={user ? (validateUserData(user) ?? undefined) : undefined}
          queueTypes={queueTypes}
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
          user={user ? (validateUserData(user) ?? undefined) : undefined}
        />
      ) : null}

      {bulkComposer?.open && user ? (
        <BulkComposerModal
          open={true}
          onClose={() => setBulkComposer(null)}
          onSuccess={() => setBulkComposer(null)}
          mode={bulkComposer.mode}
          initialPosts={bulkComposer.initialPosts}
          user={{
            id: user.id,
            timezone: user.timezone ?? undefined,
            scheduleInterval: Array.isArray(user.scheduleInterval)
              ? user.scheduleInterval.map((s) =>
                  typeof s === "string" ? parseInt(s, 10) : s
                )
              : undefined,
          }}
          queueTypes={queueTypes}
          hashTagPresets={
            Array.isArray(hashTagPresets)
              ? (hashTagPresets as Array<{
                  id: string;
                  name: string;
                  tags: string;
                }>)
              : undefined
          }
        />
      ) : null}

      {showPublishModal && modalPostId && (modalPost || modalLongFormPost) ? (
        <PublishResultModal
          isOpen={showPublishModal}
          postId={modalPostId}
          publishAttemptId={null} // Scheduled posts don't have publishAttemptId yet
          action="schedule"
          postType={getPostTypeFromPost(modalPost, modalLongFormPost)}
          scheduledFor={
            modalPost?.scheduledAtUtc ??
            modalLongFormPost?.scheduledAtUtc ??
            null
          }
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
  /* eslint-enable sonarjs/cognitive-complexity */
}
