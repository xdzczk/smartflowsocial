import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";

import MediaModal from "~/components/ui/MediaModal";
import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import AllContentListing from "~/features/posts/components/AllContentListing";
import { BulkDeleteBar } from "~/features/posts/components/BulkDeleteBar";
import { DashboardHeader } from "~/features/posts/components/DashboardHeader";
import { EditPostModal } from "~/features/posts/components/EditPostModal";
import LongFormDetailsModal from "~/features/posts/components/LongFormDetailsModal";
import LongFormListing from "~/features/posts/components/LongFormListing";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import { PostsSearch } from "~/features/posts/components/PostsSearch";
import PostTypeTabs from "~/features/posts/components/PostTypeTabs";
import QueueSelectionTabs from "~/features/posts/components/QueueSelectionTabs";
import { ScheduledPostsTable } from "~/features/posts/components/ScheduledPostsTable";
import { SimpleRescheduleModal } from "~/features/posts/components/SimpleRescheduleModal";
import { useScheduledState } from "~/features/posts/hooks/useScheduledState";
import { handleScheduledAction } from "~/features/posts/services/scheduled-action.server";
import { loadScheduledData } from "~/features/posts/services/scheduled-loader.server";
import { withErrorHandling, withActionErrorHandling } from "~/lib/error-handler.server";

async function loaderImpl({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to scheduled posts feature
  await requireFeatureAccess(userId, "scheduled");

  const queueType = params.queueType || "all";

  const data = await loadScheduledData(userId, queueType);
  return data;
}

export const loader = withErrorHandling(loaderImpl);

export const action = withActionErrorHandling(async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const result = await handleScheduledAction(formData, userId);
  
  if (result.error) {
    return json(result, { status: 400 });
  }
  
  return json(result);
});

type LoaderData = Awaited<ReturnType<typeof loaderImpl>>;

export default function ScheduledPosts() {
  const data = useLoaderData<LoaderData>();
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    hashTagPresets,
  } = data;
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
              setSelectedPost(content.originalData as unknown as { id: string; content?: string; caption?: string; fileUrl?: string[]; queueType?: { name: string } | null; scheduledFor?: string; signedEvent?: unknown } | null);
            } else {
              setSelectedLongFormPost(content.originalData as unknown as { id: string; title?: string; content?: string; scheduledFor?: string; queueType?: { name: string } | null; signedEvent?: unknown } | null);
            }
          }}
          selectedItems={selectedPosts}
          onToggleSelection={togglePostSelection}
          onToggleSelectAll={toggleSelectAll}
          showBulkActions={true}
          onBulkDelete={handleBulkDelete}
          bulkDeleteState={bulkDeleteFetcher.state}
          onEditPost={(post) => handleEditPost(post as unknown as { id: string; content?: string; caption?: string; fileUrl?: string[] } | null)}
          onReschedulePost={(post) => handleReschedulePost(post as unknown as { id: string; scheduledFor?: string; fileUrl?: string[] } | null)}
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
            posts={filteredPosts as unknown as { id: string; caption?: string; fileUrl?: string[]; scheduledFor?: string; queueType?: string; signedEvent?: unknown; nostrEvent?: unknown; postType?: string }[]}
            sortConfig={sortConfig}
            onRequestSort={requestSort}
            selectedPosts={selectedPosts}
            onToggleSelection={togglePostSelection}
            onToggleSelectAll={toggleSelectAll}
            countdowns={countdowns}
            userTimezone={user?.timezone}
            onPostClick={(post) => setSelectedPost(post as unknown as { id: string; caption?: string; fileUrl?: string[]; scheduledFor?: string; signedEvent?: unknown } | null)}
            onEditPost={(post) => handleEditPost(post as unknown as { id: string; content?: string; caption?: string; fileUrl?: string[] } | null)}
            onReschedulePost={(post) => handleReschedulePost(post as unknown as { id: string; scheduledFor?: string; fileUrl?: string[] } | null)}
            onMediaClick={handleMediaClick}
            bulkDeleteState={bulkDeleteFetcher.state}
          />

          {selectedPost ? (
            <PostDetailsModal
              post={selectedPost as unknown as { id: string; caption?: string; fileUrl?: string[]; scheduledFor?: string; signedEvent?: unknown; queueType?: { name: string } | null }}
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
          userTimezone={user?.timezone}
          onPostSelect={(post) => {
            setSelectedLongFormPost(post as unknown as { id: string; title?: string; content?: string; scheduledFor?: string; queueType?: { name: string } | null; signedEvent?: unknown } | null);
          }}
          onEditPost={(post) => handleEditPost(post as unknown as { id: string; title?: string; content?: string } | null)}
          onReschedulePost={(post) => handleReschedulePost(post as unknown as { id: string; scheduledFor?: string } | null)}
        />
      )}

      {/* Long Form Post Details Modal */}
      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost as unknown as { id: string; title?: string; content?: string; scheduledFor?: string; queueType?: { name: string } | null; signedEvent?: unknown }}
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
