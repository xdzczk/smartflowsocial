import { useSearchParams, useNavigate, useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

import MediaModal from "~/components/ui/MediaModal";
import type { LongFormPostData, PostData } from "~/features/posts/server";
import {
  AllContentListing,
  BulkDeleteBar,
  DashboardHeader,
  EditPostModal,
  LongFormDetailsModal,
  LongFormListing,
  PostDetailsModal,
  PostsSearch,
  PostTypeTabs,
  QueueSelectionTabs,
  ScheduledPostsTable,
  SimpleRescheduleModal,
  useScheduledState,
  useScheduledPostsInfiniteData,
} from "~/features/posts/ui";
import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";
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
  const postFetcher = useFetcher();
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

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") ?? "all";

  // Check for scheduled URL param
  useEffect(() => {
    const scheduledPostId = searchParams.get("scheduled");
    if (scheduledPostId && user) {
      // Use setTimeout to avoid setState in effect warning
      setTimeout(() => {
        setModalPostId(scheduledPostId);
        // Fetch post data
        postFetcher.load(`/api/posts/${scheduledPostId}`);
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
          scheduledAtUtc?: Date | null;
        };
        longFormPost?: {
          id: string;
          publishAttemptId: string | null;
          currentState?: string | null;
          scheduledAtUtc?: Date | null;
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
          newSearchParams.delete("scheduled");
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

  const {
    sortConfig,
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
          basePath="/dashboard"
        />
      ) : null}

      {/* Content based on current tab */}
      {currentTab === "all" ? (
        <AllContentListing
          content={allContent}
          type="scheduled"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user?.timezone ?? undefined}
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
        />
      ) : currentTab === "posts" ? (
        <div>
          <PostsSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />

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
            userTimezone={user?.timezone ?? undefined}
            onPostClick={(post) => setSelectedPost(post)}
            onEditPost={(post) =>
              handleEditPost(post as PostData | LongFormPostData)
            }
            onReschedulePost={(post) =>
              handleReschedulePost(post as PostData | LongFormPostData)
            }
            onMediaClick={handleMediaClick}
            bulkDeleteState={bulkDeleteFetcher.state}
          />

          {selectedPost ? (
            <PostDetailsModal
              post={selectedPost}
              onClose={() => setSelectedPost(null)}
              showSignedEvent={true}
              type="scheduled"
              userTimezone={user?.timezone ?? undefined}
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
          userTimezone={user?.timezone ?? undefined}
          onPostSelect={(post) => {
            setSelectedLongFormPost(post as LongFormPostData);
          }}
          onEditPost={(post) =>
            handleEditPost(post as PostData | LongFormPostData)
          }
          onReschedulePost={(post) =>
            handleReschedulePost(post as PostData | LongFormPostData)
          }
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

      {/* Long Form Post Details Modal */}
      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
          type="scheduled"
          showSignedEvent={true}
          userTimezone={user?.timezone ?? undefined}
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
