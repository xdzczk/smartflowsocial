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
  handleDashboardAction,
  loadDashboardData,
  type PostData,
  type LongFormPostData,
  type CombinedContent,
  type LongFormPostType as _LongFormPostType,
  type UserData as _UserData,
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
  useDashboardState,
  useDashboardData,
  type QueueType,
  type HashTagPreset,
} from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";
import {
  extractPostData,
  extractLongFormPostData,
} from "~/lib/validation/combined-content";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { convertPostDataArrayToScheduledTablePosts } from "~/lib/validation/post-data-conversion";
import { dashboardLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
import { validateUserData } from "~/lib/validation/user-data";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const userId = await requireUserId(request);

    // Check if user has access to the dashboard feature
    await requireFeatureAccess(userId, "dashboard");

    // Check for success message in URL params
    const url = new URL(request.url);
    const planActivated = url.searchParams.get("planActivated");
    const successMessage = url.searchParams.get("message");

    // Get queueType from URL params (query string) or route params, default to "all"
    const queueType =
      url.searchParams.get("queueType") ?? params["queueType"] ?? "all";

    const data = await loadDashboardData(userId, queueType);

    // Add URL params to data before validation
    const dataWithParams = {
      ...data,
      planActivated,
      successMessage,
    };

    // Validate loader response with Zod schema
    const validatedData = validateLoaderResponse(
      dataWithParams,
      dashboardLoaderDataSchema
    );

    return json(validatedData);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {
      scheduledPosts: [],
      longformPosts: [],
      user: null,
      queueTypes: [],
      hashTagPresets: [],
      postStatistics: undefined,
      selectedQueueType: "all",
    });
  }
};

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const formData = await request.formData();
      const result = await handleDashboardAction(formData, userId);

      // Check if result is a Response (redirect/error response)
      if (result instanceof Response) {
        return result;
      }

      // Check if result has error property
      if (typeof result === "object" && "error" in result && result.error) {
        return json(result, { status: 400 });
      }

      return json(result);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

// ============================================================================
// Helper Functions
// ============================================================================

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
    user: _user,
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
        posts={convertPostDataArrayToScheduledTablePosts(filteredPosts)}
        sortConfig={sortConfig}
        onRequestSort={requestSort}
        selectedPosts={selectedPosts}
        onToggleSelection={togglePostSelection}
        onToggleSelectAll={toggleSelectAll}
        countdowns={countdowns}
        userTimezone={userTimezone}
        onPostClick={(post) => {
          setSelectedPost(post as PostData);
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
  setSelectedLongFormPost: (post: LongFormPostData | null) => void;
  handleEditPost: (post: PostData | LongFormPostData) => void;
  handleReschedulePost: (post: PostData | LongFormPostData) => void;
}) {
  const {
    longformPosts,
    searchTerm,
    setSearchTerm,
    userTimezone,
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
        />
      ) : null}
    </>
  );
}

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
          setSelectedLongFormPost,
          handleEditPost,
          handleReschedulePost,
        })
      )}

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
        handleCloseEditModal,
        handleCloseRescheduleModal,
        handleModalSuccess,
      })}
    </>
  );
}
