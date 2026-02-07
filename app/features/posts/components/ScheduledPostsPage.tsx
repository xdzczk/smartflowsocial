import { useSearchParams, useNavigate } from "@remix-run/react";
import { useState } from "react";

import MediaModal from "~/components/ui/MediaModal";
import { usePostResultFromUrl } from "~/features/posts/hooks/usePostResultFromUrl";
import type { LongFormPostData, PostData } from "~/features/posts/server";
import {
  AllContentListing,
  BulkDeleteBar,
  DashboardHeader,
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
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useInfiniteScrollSentinel } from "~/lib/hooks/useInfiniteScrollSentinel";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import {
  extractLongFormPostData,
  extractPostData,
} from "~/lib/validation/combined-content";
import { validateUserData } from "~/lib/validation/user-data";

import {
  getPostTypeFromPost,
  getNewPostUrl,
} from "../utils/publish-result.utils";

import PublishResultModal from "./PublishResultModal";
import { ScheduleRepostQuoteModal } from "./ScheduleRepostQuoteModal";

/* eslint-disable sonarjs/cognitive-complexity -- Page orchestrator: tabs, queue filters, table/list content, modals */
export default function ScheduledPostsPage() {
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

  const currentTab = searchParams.get("tab") ?? "all";

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

  return (
    <div>
      <DashboardHeader
        currentTab={currentTab}
        allContentCount={totalContentCount}
        postsCount={totalPostsCount}
        longformCount={totalLongformCount}
      />

      {/* Post Type Tabs */}
      <PostTypeTabs
        currentTab={currentTab}
        allContent={allContent}
        posts={filteredPosts}
        longformPosts={longformPosts}
        basePath="/dashboard/scheduled"
        totalContentCount={totalContentCount}
        totalPostsCount={totalPostsCount}
        totalLongformCount={totalLongformCount}
      />

      {/* Queue Selection Tabs */}
      {currentTab === "all" ||
      currentTab === "posts" ||
      currentTab === "longform" ? (
        <QueueSelectionTabs
          currentTab={currentTab}
          queueTypes={queueTypes}
          basePath="/dashboard/scheduled"
        />
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
          onBulkDelete={handleBulkDelete}
          bulkDeleteState={bulkDeleteFetcher.state}
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
      ) : currentTab === "posts" ? (
        <div>
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
            onSortChange={(key, direction) => setSortConfig({ key, direction })}
            prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
            sentinelRef={isMobile ? sentinelRef : undefined}
            isFetchingNextPage={isFetchingNextPage}
            onScrollContainerReady={isMobile ? setScrollRoot : undefined}
          />

          {selectedPost ? (
            <PostDetailsModal
              post={selectedPost}
              onClose={() => setSelectedPost(null)}
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

      {/* Long Form Post Details Modal */}
      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
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
