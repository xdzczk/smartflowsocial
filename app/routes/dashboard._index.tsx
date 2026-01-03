import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useSearchParams } from "@remix-run/react";
import { useState, useEffect } from "react";

import MediaModal from "~/components/ui/MediaModal";
import { requireUserId } from "~/features/auth";
import { requireFeatureAccess } from "~/features/payments";
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
  useDashboardState,
  handleDashboardAction,
  loadDashboardData,
  useDashboardData,
  type PostData,
  type LongFormPostData,
  type LongFormPostType,
  type UserData,
} from "~/features/posts";
import { withCSRFProtection } from "~/lib/csrf";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);

  // Check if user has access to the dashboard feature
  await requireFeatureAccess(userId, "dashboard");

  // Check for success message in URL params
  const url = new URL(request.url);
  const planActivated = url.searchParams.get("planActivated");
  const successMessage = url.searchParams.get("message");

  const queueType = params.queueType ?? "all";

  const data = await loadDashboardData(userId, queueType);

  return json({
    ...data,
    planActivated,
    successMessage,
  });
};

export const action = withCSRFProtection(async ({ request }: ActionFunctionArgs) => {
  try {
    const userId = await requireUserId(request);
    const formData = await request.formData();
    const result = await handleDashboardAction(formData, userId);

    // Check if result is a Response (redirect/error response)
    if (result instanceof Response) {
      return result;
    }

    // Check if result has error property
    if (result && typeof result === "object" && "error" in result && result.error) {
      return json(result, { status: 400 });
    }

    return json(result);
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
});

export default function DashboardIndex() {
  // Use TanStack Query for data fetching with caching
  const {
    scheduledPosts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    hashTagPresets,
    isLoading: _isDataLoading,
  } = useDashboardData();

  // Get URL params for success messages (not part of query data)
  const [searchParams] = useSearchParams();
  const planActivated = searchParams.get("planActivated");
  const successMessage = searchParams.get("message");

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") ?? "all";

  const [showSuccessMessage, setShowSuccessMessage] = useState(
    !!(planActivated && typeof planActivated === "string"),
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
    userTimezone:
      user &&
      typeof user === "object" &&
      "timezone" in user &&
      typeof user.timezone === "string"
        ? user.timezone
        : undefined,
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
          userTimezone={user?.timezone ?? undefined}
          onPostSelect={(content) => {
            if (content.type === "post") {
              setSelectedPost(content.originalData as PostData);
            } else {
              setSelectedLongFormPost(
                content.originalData as unknown as LongFormPostData,
              );
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
            // @ts-expect-error - filteredPosts is PostData[] but ScheduledPostsTable expects Post[]
            posts={filteredPosts}
            sortConfig={sortConfig}
            onRequestSort={requestSort}
            selectedPosts={selectedPosts}
            onToggleSelection={togglePostSelection}
            onToggleSelectAll={toggleSelectAll}
            countdowns={countdowns}
            userTimezone={
              user &&
              typeof user === "object" &&
              "timezone" in user &&
              typeof user.timezone === "string"
                ? user.timezone
                : undefined
            }
            onPostClick={(post) => {
              if (post && typeof post === "object") {
                setSelectedPost(post as PostData);
              }
            }}
            onEditPost={(post) => {
              if (post && typeof post === "object") {
                handleEditPost(post as PostData | LongFormPostData);
              }
            }}
            onReschedulePost={(post) => {
              if (post && typeof post === "object") {
                handleReschedulePost(post as PostData | LongFormPostData);
              }
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
              userTimezone={
                user &&
                typeof user === "object" &&
                "timezone" in user &&
                typeof user.timezone === "string"
                  ? user.timezone
                  : undefined
              }
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
          posts={longformPosts as unknown as LongFormPostType[]}
          type="scheduled"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user?.timezone ?? undefined}
          onPostSelect={(post) => {
            setSelectedLongFormPost(post as unknown as LongFormPostData);
          }}
          onEditPost={(post) =>
            handleEditPost(post as unknown as PostData | LongFormPostData)
          }
          onReschedulePost={(post) =>
            handleReschedulePost(post as unknown as PostData | LongFormPostData)
          }
        />
      )}

      {/* Long Form Post Details Modal */}
      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost as unknown as LongFormPostType}
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
          user={user as unknown as UserData | undefined}
          queueTypes={queueTypes}
          hashTagPresets={
            Array.isArray(hashTagPresets)
              ? (hashTagPresets as unknown as {
                  id: string;
                  name: string;
                  tags: string;
                  description?: string | null;
                }[])
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
          user={user ? (user as unknown as UserData) : undefined}
          queueTypes={queueTypes}
        />
      ) : null}
    </>
  );
}
