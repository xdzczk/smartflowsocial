import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { useState, useEffect } from "react";

import MediaModal from "~/components/ui/MediaModal";
import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess } from "~/features/payments/subscriptions.server";
import AllContentListing from "~/features/posts/components/AllContentListing";
import { EditPostModal } from "~/features/posts/components/EditPostModal";
import LongFormDetailsModal from "~/features/posts/components/LongFormDetailsModal";
import LongFormListing from "~/features/posts/components/LongFormListing";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import PostTypeTabs from "~/features/posts/components/PostTypeTabs";
import QueueSelectionTabs from "~/features/posts/components/QueueSelectionTabs";
import { SimpleRescheduleModal } from "~/features/posts/components/SimpleRescheduleModal";
import Statistics from "~/features/posts/components/Statistics";
import { SuccessMessage } from "~/features/posts/components/SuccessMessage";
import { DashboardHeader } from "~/features/posts/components/DashboardHeader";
import { ScheduledPostsTable } from "~/features/posts/components/ScheduledPostsTable";
import { BulkDeleteBar } from "~/features/posts/components/BulkDeleteBar";
import { PostsSearch } from "~/features/posts/components/PostsSearch";
import { useDashboardState } from "~/features/posts/hooks/useDashboardState";
import { loadDashboardData } from "~/features/posts/services/dashboard-loader.server";
import { handleDashboardAction } from "~/features/posts/services/dashboard-action.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);

  // Check if user has access to the dashboard feature
  await requireFeatureAccess(userId, "dashboard");

  // Check for success message in URL params
  const url = new URL(request.url);
  const planActivated = url.searchParams.get("planActivated");
  const successMessage = url.searchParams.get("message");

  const queueType = params.queueType || "all";

  const data = await loadDashboardData(userId, queueType);

  return json({
    ...data,
    planActivated,
    successMessage,
  });
};

export async function action({ request }: ActionFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const formData = await request.formData();
    const result = await handleDashboardAction(formData, userId);
    
    if (result.error) {
      return json(result, { status: 400 });
    }
    
    return json(result);
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

export default function DashboardIndex() {
  const {
    scheduledPosts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    hashTagPresets,
    planActivated,
    successMessage,
  } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") || "all";

  const [showSuccessMessage, setShowSuccessMessage] = useState(!!planActivated);

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
    userTimezone: user?.timezone,
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
      />

      <DashboardHeader
        currentTab={currentTab}
        allContentCount={allContent.length}
        postsCount={filteredPosts.length}
        longformCount={longformPosts.length}
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
    </>
  );
}
