import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useSearchParams } from "@remix-run/react";

import MediaModal from "~/components/ui/MediaModal";
import { requireUserId } from "~/features/auth";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  handleScheduledAction,
  loadScheduledData,
  type PostData,
  type LongFormPostData,
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
  useScheduledState,
  useScheduledPostsData,
} from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";
import {
  extractPostData,
  extractLongFormPostData,
} from "~/lib/validation/combined-content.server";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { scheduledPostsLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
import { validateUserData } from "~/lib/validation/user-data.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to scheduled posts feature
    await requireFeatureAccess(userId, "scheduled");

    const queueType = params.queueType ?? "all";

    const data = await loadScheduledData(userId, queueType);
    
    // Validate loader response with Zod schema
    return validateLoaderResponse(data, scheduledPostsLoaderDataSchema);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}

export const action = withCSRFProtection(async ({ request }: ActionFunctionArgs) => {
  try {
    const userId = await requireUserId(request);
    const formData = await request.formData();
    const result = await handleScheduledAction(formData, userId);

    // Type narrowing: check if result is a Response
    if (result instanceof Response) {
      return result;
    }

    // Type narrowing: check if result has error property
    if (typeof result === "object" && result !== null && "error" in result && result.error) {
      return json(result, { status: 400 });
    }

    return json(result);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
});

type _LoaderData = Awaited<ReturnType<typeof loader>>;

export default function ScheduledPosts() {
  // Use TanStack Query for data fetching with caching
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    hashTagPresets,
    isLoading: _isDataLoading,
  } = useScheduledPostsData();

  const [searchParams] = useSearchParams();

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") ?? "all";

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
    userTimezone: user?.timezone ?? undefined,
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
            posts={filteredPosts.map(
              (
                post,
              ): {
                id: string;
                caption?: string | null;
                scheduledFor: string;
                fileUrl?: string[] | null;
                queueType?: { name: string; color?: string | null } | null;
                repost?: boolean;
                isQuotedPost?: boolean;
                isPostSigned?: boolean;
              } => ({
                id: post.id,
                caption: post.caption ?? null,
                scheduledFor: (() => {
                  const scheduledForValue: unknown = post.scheduledFor;
                  if (typeof scheduledForValue === "string")
                    return scheduledForValue;
                  if (scheduledForValue instanceof Date)
                    return scheduledForValue.toISOString();
                  return "";
                })(),
                fileUrl: Array.isArray(post.fileUrl)
                  ? post.fileUrl
                  : post.fileUrl
                    ? [post.fileUrl]
                    : null,
                queueType: post.queueType
                  ? {
                      name: post.queueType.name,
                      color: post.queueType.color ?? null,
                    }
                  : null,
                repost: post.repost ?? false,
                isQuotedPost: post.isQuotedPost ?? false,
                isPostSigned: post.signedEvent ? true : false,
              }),
            )}
            sortConfig={sortConfig}
            onRequestSort={requestSort}
            selectedPosts={selectedPosts}
            onToggleSelection={togglePostSelection}
            onToggleSelectAll={toggleSelectAll}
            countdowns={countdowns}
            userTimezone={user?.timezone ?? undefined}
            onPostClick={(post) => setSelectedPost(post as PostData)}
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
          user={user ? validateUserData(user) ?? undefined : undefined}
          queueTypes={queueTypes}
          hashTagPresets={
            Array.isArray(hashTagPresets)
              ? (hashTagPresets as {
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
          user={user ? validateUserData(user) ?? undefined : undefined}
          queueTypes={queueTypes}
        />
      ) : null}
    </div>
  );
}
