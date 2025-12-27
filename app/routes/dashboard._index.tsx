import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { useState, useEffect } from "react";

import MediaModal from "~/components/ui/MediaModal";
import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess } from "~/features/payments/subscriptions.server";
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
  type PostData,
  type LongFormPostData,
  type CombinedContent,
  type QueueType,
  type UserData,
  convertJsonValueToScheduleConfig,
} from "~/features/posts";
import type { LongFormPost } from "~/models/longformpost.server";

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
  const loaderData = useLoaderData<typeof loader>();
  const scheduledPostsRaw = "scheduledPosts" in loaderData && Array.isArray(loaderData.scheduledPosts) ? loaderData.scheduledPosts : [];
  const longformPostsRaw = "longformPosts" in loaderData && Array.isArray(loaderData.longformPosts) ? loaderData.longformPosts : [];
  const allContentRaw = "allContent" in loaderData && Array.isArray(loaderData.allContent) ? loaderData.allContent : [];
  const user = "user" in loaderData ? loaderData.user : null;
  const queueTypesRaw = "queueTypes" in loaderData && Array.isArray(loaderData.queueTypes) ? loaderData.queueTypes : [];
  const hashTagPresets = "hashTagPresets" in loaderData && Array.isArray(loaderData.hashTagPresets) ? loaderData.hashTagPresets : [];
  const planActivated = "planActivated" in loaderData ? loaderData.planActivated : null;
  const successMessage = "successMessage" in loaderData ? loaderData.successMessage : null;
  const [searchParams] = useSearchParams();

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") || "all";

  const [showSuccessMessage, setShowSuccessMessage] = useState(!!(planActivated && typeof planActivated === "string"));

  // Type assertions for Remix JsonifyObject serialization
  // Remix serializes Date objects to strings, so we need to assert these types
  // The loader returns proper types, but Remix serializes them
  const scheduledPosts: PostData[] = Array.isArray(scheduledPostsRaw) ? scheduledPostsRaw as unknown as PostData[] : [];
  const longformPosts: LongFormPostData[] = Array.isArray(longformPostsRaw) ? longformPostsRaw as unknown as LongFormPostData[] : [];
  const allContent: CombinedContent[] = Array.isArray(allContentRaw) ? allContentRaw as unknown as CombinedContent[] : [];
  const queueTypes: QueueType[] = Array.isArray(queueTypesRaw) ? queueTypesRaw.map((qt: unknown) => {
    if (qt && typeof qt === "object" && qt !== null && "id" in qt && "name" in qt) {
      const q = qt as { id?: unknown; name?: unknown; color?: unknown; scheduleType?: unknown; scheduleConfig?: unknown; isEnabled?: unknown; userId?: unknown };
      const id = typeof q.id === "string" ? q.id : String(q.id ?? "");
      const name = typeof q.name === "string" ? q.name : String(q.name ?? "");
      const color = q.color !== null && q.color !== undefined ? (typeof q.color === "string" ? q.color : String(q.color)) : null;
      const scheduleType = typeof q.scheduleType === "string" && (q.scheduleType === "INTERVAL" || q.scheduleType === "FIXED_SLOTS") ? q.scheduleType : undefined;
      const scheduleConfig = convertJsonValueToScheduleConfig(q.scheduleConfig);
      const isEnabled = typeof q.isEnabled === "boolean" ? q.isEnabled : q.isEnabled !== false;
      const userId = typeof q.userId === "string" ? q.userId : "";
      const result: QueueType = {
        id,
        name,
        color,
        description: undefined,
        scheduleType,
        scheduleConfig,
        isEnabled,
        userId,
      };
      return result;
    }
    return null;
  }).filter((qt): qt is QueueType => qt !== null) : [];

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
    userTimezone: user && typeof user === "object" && "timezone" in user && typeof user.timezone === "string" ? user.timezone : undefined,
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
              setSelectedLongFormPost(content.originalData as LongFormPostData);
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
            userTimezone={user && typeof user === "object" && "timezone" in user && typeof user.timezone === "string" ? user.timezone : undefined}
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
              userTimezone={user && typeof user === "object" && "timezone" in user && typeof user.timezone === "string" ? user.timezone : undefined}
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
          posts={longformPosts as unknown as LongFormPost[]}
          type="scheduled"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user?.timezone ?? undefined}
          onPostSelect={(post) => {
            setSelectedLongFormPost(post as unknown as LongFormPostData);
          }}
          onEditPost={(post) => handleEditPost(post as unknown as PostData | LongFormPostData)}
          onReschedulePost={(post) => handleReschedulePost(post as unknown as PostData | LongFormPostData)}
        />
      )}

      {/* Long Form Post Details Modal */}
      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost as unknown as LongFormPost}
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
          hashTagPresets={Array.isArray(hashTagPresets) ? hashTagPresets as unknown as { id: string; name: string; tags: string; description?: string | null }[] : []}
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
