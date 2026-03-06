import { useFetcher, useSearchParams, useNavigate } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";

import MediaModal from "~/components/ui/MediaModal";
import { usePostResultFromUrl } from "~/features/posts/hooks/usePostResultFromUrl";
import { useRefreshPostViews } from "~/features/posts/hooks/useRefreshPostViews";
import type { LongFormPostData, PostData } from "~/features/posts/server";
import type { BulkPost, PostFetcher } from "~/features/posts/types";
import {
  AllContentListing,
  BulkComposerModal,
  BulkDeleteBar,
  ContentListPageHeader,
  EditPostModal,
  LongFormDetailsModal,
  LongFormListing,
  PostDetailsModal,
  PostTypeTabs,
  QueueSelectionTabs,
  ScheduledPostsTable,
  SimpleRescheduleModal,
  useScheduledState,
  useScheduledPostsInfiniteData,
} from "~/features/posts/ui";
import type { BulkComposerPayload } from "~/features/posts/usePublishedPosts";
import {
  convertQuoteDataToBulkPosts,
  convertScheduledPostsToBulkPosts,
  loadScheduledRepostDataAsBulkPosts,
} from "~/features/posts/utils/bulk-composer-data";
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

import { getTodayInTimezone } from "../utils/date-range-filter";
import {
  getPostTypeFromPost,
  getNewPostUrl,
} from "../utils/publish-result.utils";

import { DateRangeFilter } from "./DateRangeFilter";
import { DateRangeQuickPresets } from "./DateRangeQuickPresets";
import PublishResultModal from "./PublishResultModal";
import { ScheduleRepostQuoteModal } from "./ScheduleRepostQuoteModal";

/* eslint-disable sonarjs/cognitive-complexity -- Page orchestrator: tabs, queue filters, table/list content, modals */
export default function ScheduledPostsPage() {
  const refreshPostViews = useRefreshPostViews();
  // Use infinite query for data fetching with infinite scroll
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    hashTagPresets,
    totalContentCount,
    totalPostsCount,
    totalRepostsCount,
    totalLongformCount,
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

  const setDateRange = (range: { from: string; to: string }) => {
    const next = new URLSearchParams(searchParams);
    if (range.from) next.set("dateFrom", range.from);
    else next.delete("dateFrom");
    if (range.to) next.set("dateTo", range.to);
    else next.delete("dateTo");
    next.delete("page"); // reset to first page when changing date range
    setSearchParams(next);
  };

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

  return (
    <div className="flex min-h-screen flex-col">
      <ContentListPageHeader pageType="scheduled" currentTab={currentTab} />

      <div className="border-border mb-6 flex flex-col items-end gap-2 border-b md:flex-row md:flex-nowrap md:items-center">
        <div className="min-w-0 flex-1">
          <PostTypeTabs
            currentTab={currentTab}
            allContent={allContent}
            posts={filteredPosts}
            longformPosts={longformPosts}
            basePath="/dashboard/scheduled"
            totalContentCount={totalContentCount}
            totalPostsCount={totalPostsCount}
            totalRepostsCount={totalRepostsCount}
            totalLongformCount={totalLongformCount}
            inRow
          />
        </div>
        <div className="flex w-full flex-row flex-nowrap items-center gap-2 md:ml-auto md:w-auto md:flex-shrink-0">
          <DateRangeFilter
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            idPrefix="scheduled"
            className="w-full max-md:w-auto md:w-auto md:flex-shrink-0"
            minDate={getTodayInTimezone(userTimezone)}
            userDateFormat={
              user?.dateFormat === "mmddyyyy"
                ? "mmddyyyy"
                : user?.dateFormat === "yyyymmdd"
                  ? "yyyymmdd"
                  : "ddmmyyyy"
            }
          />
          <DateRangeQuickPresets
            variant="future"
            userTimezone={userTimezone}
            onDateRangeChange={setDateRange}
          />
          {currentTab === "all" ||
          currentTab === "posts" ||
          currentTab === "reposts" ||
          currentTab === "longform" ? (
            <QueueSelectionTabs
              currentTab={currentTab}
              queueTypes={queueTypes}
              basePath="/dashboard/scheduled"
            />
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
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
            onBulkDelete={handleBulkDelete}
            bulkDeleteState={bulkDeleteFetcher.state}
            onBulkEditReschedule={handleBulkEditReschedule}
            onBulkScheduledRepost={handleBulkScheduledRepost}
            onBulkQuote={handleBulkQuote}
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
          />
        ) : currentTab === "posts" || currentTab === "reposts" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <BulkDeleteBar
              selectedCount={selectedPosts.size}
              onBulkDelete={handleBulkDelete}
              isDeleting={bulkDeleteFetcher.state !== "idle"}
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
          onDeleted={refreshPostViews}
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
          onDeleted={refreshPostViews}
          type="scheduled"
          showSignedEvent={true}
          userTimezone={userTimezone}
          userTimeFormat={userTimeFormat}
        />
      ) : null}

      {/* Edit Post Modal */}
      {showEditModal && postToEdit ? (
        <EditPostModal
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
        <SimpleRescheduleModal
          post={postToReschedule}
          onClose={handleCloseRescheduleModal}
          onConfirm={handleModalSuccess}
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
    </div>
  );
  /* eslint-enable sonarjs/cognitive-complexity */
}
