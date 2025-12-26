import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";

import MediaModal from "~/components/ui/MediaModal";
import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import AllContentListing from "~/features/posts/components/AllContentListing";
import { EditPostModal } from "~/features/posts/components/EditPostModal";
import LongFormDetailsModal from "~/features/posts/components/LongFormDetailsModal";
import LongFormListing from "~/features/posts/components/LongFormListing";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import PostTypeTabs from "~/features/posts/components/PostTypeTabs";
import QueueSelectionTabs from "~/features/posts/components/QueueSelectionTabs";
import { SimpleRescheduleModal } from "~/features/posts/components/SimpleRescheduleModal";
import { DashboardHeader } from "~/features/posts/components/DashboardHeader";
import { ScheduledPostsTable } from "~/features/posts/components/ScheduledPostsTable";
import { BulkDeleteBar } from "~/features/posts/components/BulkDeleteBar";
import { PostsSearch } from "~/features/posts/components/PostsSearch";
import { useScheduledState } from "~/features/posts/hooks/useScheduledState";
import { loadScheduledData } from "~/features/posts/services/scheduled-loader.server";
import { handleScheduledAction } from "~/features/posts/services/scheduled-action.server";
import { withErrorHandling, withActionErrorHandling } from "~/lib/error-handler.server";

export const loader = withErrorHandling(async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to scheduled posts feature
  await requireFeatureAccess(userId, "scheduled");

  const queueType = params.queueType || "all";

  const data = await loadScheduledData(userId, queueType);
  return data;
});

export const action = withActionErrorHandling(async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const result = await handleScheduledAction(formData, userId);
  
  if (result.error) {
    return json(result, { status: 400 });
  }
  
  return json(result);
});

export default function ScheduledPosts() {
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    hashTagPresets,
  } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") || "all";

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
    deleteFetcher,
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
        allContentCount={allContent.length}
        postsCount={filteredPosts.length}
        longformCount={longformPosts.length}
      />

      {/* Post Type Tabs */}
      <PostTypeTabs
        currentTab={currentTab}
        allContent={allContent}
        posts={filteredPosts}
        longformPosts={longformPosts}
        basePath="/dashboard/scheduled"
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
          userTimezone={user?.timezone}
          onPostSelect={(content) => {
            if (content.type === "post") {
              setSelectedPost(content.originalData);
            } else {
              setSelectedLongFormPost(content.originalData);
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
            userTimezone={user?.timezone}
            onPostClick={setSelectedPost}
            onEditPost={handleEditPost}
            onReschedulePost={handleReschedulePost}
            onMediaClick={handleMediaClick}
            bulkDeleteState={bulkDeleteFetcher.state}
          />

          {selectedPost ? (
            <PostDetailsModal
              post={selectedPost}
              onClose={() => setSelectedPost(null)}
              showSignedEvent={true}
              type="scheduled"
              userTimezone={user?.timezone || undefined}
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
          userTimezone={user?.timezone}
          onPostSelect={(post) => {
            setSelectedLongFormPost(post);
          }}
          onEditPost={handleEditPost}
          onReschedulePost={handleReschedulePost}
        />
      )}

      {/* Long Form Post Details Modal */}
      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
          type="scheduled"
          showSignedEvent={true}
          userTimezone={user?.timezone || undefined}
        />
      ) : null}

      {/* Edit Post Modal */}
      {showEditModal && postToEdit ? (
        <EditPostModal
          post={postToEdit}
          onClose={handleCloseEditModal}
          onConfirm={handleModalSuccess}
          user={user}
          queueTypes={queueTypes}
          hashTagPresets={hashTagPresets}
        />
      ) : null}

      {/* Reschedule Post Modal */}
      {showRescheduleModal && postToReschedule ? (
        <SimpleRescheduleModal
          post={postToReschedule}
          onClose={handleCloseRescheduleModal}
          onConfirm={handleModalSuccess}
          user={user}
          queueTypes={queueTypes}
        />
      ) : null}
    </div>
  );
}
