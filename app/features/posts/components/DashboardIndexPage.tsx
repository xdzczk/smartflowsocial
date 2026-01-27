import { useSearchParams } from "@remix-run/react";
import { useEffect, useState } from "react";

import MediaModal from "~/components/ui/MediaModal";
import type {
  CombinedContent,
  LongFormPostData,
  PostData,
} from "~/features/posts/server";
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
  Statistics,
  SuccessMessage,
  useDashboardInfiniteData,
  useDashboardState,
  type HashTagPreset,
  type QueueType,
} from "~/features/posts/ui";
import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";
import {
  extractLongFormPostData,
  extractPostData,
} from "~/lib/validation/combined-content";
import { validateUserData } from "~/lib/validation/user-data";

function getUserTimezone(user: unknown): string | undefined {
  if (
    user &&
    typeof user === "object" &&
    "timezone" in user &&
    typeof user.timezone === "string"
  ) {
    return user.timezone;
  }
  return undefined;
}

function getUserTimeFormat(user: unknown): "12h" | "24h" {
  if (
    user &&
    typeof user === "object" &&
    "timeFormat" in user &&
    user.timeFormat === "24h"
  ) {
    return "24h";
  }
  return "12h";
}

function handleContentSelection(
  content: CombinedContent,
  setSelectedPost: (post: PostData | null) => void,
  setSelectedLongFormPost: (post: LongFormPostData | null) => void
): void {
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
}

function renderPostsTabContent(props: {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedPosts: Set<string>;
  filteredPosts: PostData[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  countdowns: Record<string, string>;
  userTimezone: string | undefined;
  userTimeFormat: "12h" | "24h";
  bulkDeleteFetcher: { state: string };
  setSelectedPost: (post: PostData | null) => void;
  handleEditPost: (post: PostData | LongFormPostData) => void;
  handleReschedulePost: (post: PostData | LongFormPostData) => void;
  handleBulkDelete: () => void;
  handleMediaClick: (url: string) => void;
  requestSort: (key: string) => void;
  togglePostSelection: (postId: string) => void;
  toggleSelectAll: () => void;
  selectedPost: PostData | null;
  selectedMedia: string | null;
  isMediaModalOpen: boolean;
  handleCloseMediaModal: () => void;
  user: unknown;
}) {
  const {
    searchTerm,
    setSearchTerm,
    selectedPosts,
    filteredPosts,
    sortConfig,
    countdowns,
    userTimezone,
    userTimeFormat,
    bulkDeleteFetcher,
    setSelectedPost,
    handleEditPost,
    handleReschedulePost,
    handleBulkDelete,
    handleMediaClick,
    requestSort,
    togglePostSelection,
    toggleSelectAll,
    selectedPost,
    selectedMedia,
    isMediaModalOpen,
    handleCloseMediaModal,
  } = props;

  return (
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
        userTimezone={userTimezone}
        userTimeFormat={userTimeFormat}
        onPostClick={(post) => {
          setSelectedPost(post);
        }}
        onEditPost={(post) => {
          handleEditPost(post as PostData | LongFormPostData);
        }}
        onReschedulePost={(post) => {
          handleReschedulePost(post as PostData | LongFormPostData);
        }}
        onMediaClick={handleMediaClick}
        bulkDeleteState={bulkDeleteFetcher.state}
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

      {selectedMedia ? (
        <MediaModal
          src={selectedMedia}
          alt="Post media"
          isOpen={isMediaModalOpen}
          onClose={handleCloseMediaModal}
        />
      ) : null}
    </div>
  );
}

function renderLongformTabContent(props: {
  longformPosts: LongFormPostData[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  userTimezone: string | undefined;
  userTimeFormat: "12h" | "24h";
  setSelectedLongFormPost: (post: LongFormPostData | null) => void;
  handleEditPost: (post: PostData | LongFormPostData) => void;
  handleReschedulePost: (post: PostData | LongFormPostData) => void;
}) {
  const {
    longformPosts,
    searchTerm,
    setSearchTerm,
    userTimezone,
    userTimeFormat,
    setSelectedLongFormPost,
    handleEditPost,
    handleReschedulePost,
  } = props;

  return (
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
      onEditPost={(post) => handleEditPost(post as PostData | LongFormPostData)}
      onReschedulePost={(post) =>
        handleReschedulePost(post as PostData | LongFormPostData)
      }
    />
  );
}

function renderModals(props: {
  selectedLongFormPost: LongFormPostData | null;
  setSelectedLongFormPost: (post: LongFormPostData | null) => void;
  showEditModal: boolean;
  postToEdit: PostData | LongFormPostData | null;
  showRescheduleModal: boolean;
  postToReschedule: PostData | LongFormPostData | null;
  user: unknown;
  queueTypes: Array<string | QueueType>;
  hashTagPresets: HashTagPreset[];
  userTimezone: string | undefined;
  userTimeFormat: "12h" | "24h";
  handleCloseEditModal: () => void;
  handleCloseRescheduleModal: () => void;
  handleModalSuccess: () => void;
}) {
  const {
    selectedLongFormPost,
    setSelectedLongFormPost,
    showEditModal,
    postToEdit,
    showRescheduleModal,
    postToReschedule,
    user,
    queueTypes,
    hashTagPresets,
    userTimezone,
    userTimeFormat,
    handleCloseEditModal,
    handleCloseRescheduleModal,
    handleModalSuccess,
  } = props;

  return (
    <>
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

      {showEditModal && postToEdit ? (
        <EditPostModal
          post={postToEdit}
          onClose={handleCloseEditModal}
          onConfirm={handleModalSuccess}
          user={user ? (validateUserData(user) ?? undefined) : undefined}
          queueTypes={
            Array.isArray(queueTypes)
              ? queueTypes.filter(
                  (qt): qt is QueueType =>
                    typeof qt === "object" && "id" in qt && "name" in qt
                )
              : []
          }
          hashTagPresets={Array.isArray(hashTagPresets) ? hashTagPresets : []}
        />
      ) : null}

      {showRescheduleModal && postToReschedule ? (
        <SimpleRescheduleModal
          post={postToReschedule}
          onClose={handleCloseRescheduleModal}
          onConfirm={handleModalSuccess}
          user={user ? (validateUserData(user) ?? undefined) : undefined}
          queueTypes={
            Array.isArray(queueTypes)
              ? queueTypes.filter(
                  (qt): qt is QueueType =>
                    typeof qt === "object" && "id" in qt && "name" in qt
                )
              : []
          }
          userTimeFormat={userTimeFormat}
        />
      ) : null}
    </>
  );
}

export default function DashboardIndexPage() {
  // Use infinite query for data fetching with infinite scroll
  const {
    scheduledPosts,
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
  } = useDashboardInfiniteData();

  // Get URL params for success messages (not part of query data)
  const [searchParams] = useSearchParams();
  const planActivated = searchParams.get("planActivated");
  const successMessage = searchParams.get("message");

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") ?? "all";

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

  const [showSuccessMessage, setShowSuccessMessage] = useState(
    !!(planActivated && typeof planActivated === "string")
  );

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
  } = useDashboardState({
    scheduledPosts,
    userTimezone: getUserTimezone(user),
  });

  // Auto-hide success message after 3 seconds
  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  return (
    <>
      {/* Success Message */}
      {showSuccessMessage && successMessage ? (
        <SuccessMessage
          message={successMessage}
          onDismiss={() => setShowSuccessMessage(false)}
        />
      ) : null}

      <Statistics />

      {/* Post Type Tabs */}
      <PostTypeTabs
        currentTab={currentTab}
        allContent={allContent}
        posts={scheduledPosts}
        longformPosts={longformPosts}
        basePath="/dashboard"
        totalContentCount={totalContentCount}
        totalPostsCount={totalPostsCount}
        totalLongformCount={totalLongformCount}
      />

      <DashboardHeader
        currentTab={currentTab}
        allContentCount={totalContentCount}
        postsCount={totalPostsCount}
        longformCount={totalLongformCount}
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
          userTimeFormat={getUserTimeFormat(user)}
          onPostSelect={(content) =>
            handleContentSelection(
              content,
              setSelectedPost,
              setSelectedLongFormPost
            )
          }
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
        renderPostsTabContent({
          searchTerm,
          setSearchTerm,
          selectedPosts,
          filteredPosts,
          sortConfig,
          countdowns,
          userTimezone: getUserTimezone(user),
          userTimeFormat: getUserTimeFormat(user),
          bulkDeleteFetcher,
          setSelectedPost,
          handleEditPost,
          handleReschedulePost,
          handleBulkDelete,
          handleMediaClick,
          requestSort,
          togglePostSelection,
          toggleSelectAll,
          selectedPost: selectedPost ?? null,
          selectedMedia,
          isMediaModalOpen,
          handleCloseMediaModal,
          user,
        })
      ) : (
        renderLongformTabContent({
          longformPosts,
          searchTerm,
          setSearchTerm,
          userTimezone: getUserTimezone(user),
          userTimeFormat: getUserTimeFormat(user),
          setSelectedLongFormPost,
          handleEditPost,
          handleReschedulePost,
        })
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

      {renderModals({
        selectedLongFormPost,
        setSelectedLongFormPost,
        showEditModal,
        postToEdit,
        showRescheduleModal,
        postToReschedule,
        user,
        queueTypes: Array.isArray(queueTypes) ? queueTypes : [],
        hashTagPresets: Array.isArray(hashTagPresets) ? hashTagPresets : [],
        userTimezone: getUserTimezone(user),
        userTimeFormat: getUserTimeFormat(user),
        handleCloseEditModal,
        handleCloseRescheduleModal,
        handleModalSuccess,
      })}
    </>
  );
}
