import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";

import MediaModal from "~/components/ui/MediaModal";
import { requireUserId } from "~/features/auth";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments";
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
  handleScheduledAction,
  loadScheduledData,
  type PostData,
  type LongFormPostData,
  type CombinedContent,
  type QueueType,
  type UserData,
  convertJsonValueToScheduleConfig,
} from "~/features/posts";
import type { LongFormPostType } from "~/features/posts";
import { withErrorHandling, withActionErrorHandling } from "~/lib/error-handler.server";

async function loaderImpl({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to scheduled posts feature
  await requireFeatureAccess(userId, "scheduled");

  const queueType = params.queueType ?? "all";

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
  const postsRaw = "posts" in data && Array.isArray(data.posts) ? data.posts : [];
  const longformPostsRaw = "longformPosts" in data && Array.isArray(data.longformPosts) ? data.longformPosts : [];
  const allContentRaw = "allContent" in data && Array.isArray(data.allContent) ? data.allContent : [];
  const user = "user" in data ? data.user : null;
  const queueTypesRaw = "queueTypes" in data && Array.isArray(data.queueTypes) ? data.queueTypes : [];
  const hashTagPresets = "hashTagPresets" in data && Array.isArray(data.hashTagPresets) ? data.hashTagPresets : [];
  const [searchParams] = useSearchParams();

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") ?? "all";

  // Type assertions for Remix JsonifyObject serialization
  // Remix serializes Date objects to strings, so we need to assert these types
   
  const posts: PostData[] = Array.isArray(postsRaw) ? (postsRaw as unknown as PostData[]) : [];
   
  const longformPosts: LongFormPostData[] = Array.isArray(longformPostsRaw) ? (longformPostsRaw as unknown as LongFormPostData[]) : [];
   
  const allContent: CombinedContent[] = Array.isArray(allContentRaw) ? (allContentRaw as unknown as CombinedContent[]) : [];
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
            if (content.type === "post") {
              setSelectedPost(content.originalData as PostData);
            } else {
               
              setSelectedLongFormPost(content.originalData as unknown as LongFormPostData);
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
            posts={filteredPosts.map((post): { id: string; caption?: string | null; scheduledFor: string; fileUrl?: string[] | null; queueType?: { name: string; color?: string | null } | null; repost?: boolean; isQuotedPost?: boolean; isPostSigned?: boolean } => ({
              id: post.id,
              caption: post.caption ?? null,
              scheduledFor: (() => {
                const scheduledForValue: unknown = post.scheduledFor;
                if (typeof scheduledForValue === "string") return scheduledForValue;
                if (scheduledForValue instanceof Date) return scheduledForValue.toISOString();
                return "";
              })(),
              fileUrl: Array.isArray(post.fileUrl) ? post.fileUrl : post.fileUrl ? [post.fileUrl] : null,
              queueType: post.queueType ? { name: post.queueType.name, color: post.queueType.color ?? null } : null,
              repost: post.repost ?? false,
              isQuotedPost: post.isQuotedPost ?? false,
              isPostSigned: post.signedEvent ? true : false,
            }))}
            sortConfig={sortConfig}
            onRequestSort={requestSort}
            selectedPosts={selectedPosts}
            onToggleSelection={togglePostSelection}
            onToggleSelectAll={toggleSelectAll}
            countdowns={countdowns}
            userTimezone={user?.timezone ?? undefined}
            onPostClick={(post) => setSelectedPost(post as PostData)}
            onEditPost={(post) => handleEditPost(post as PostData | LongFormPostData)}
            onReschedulePost={(post) => handleReschedulePost(post as PostData | LongFormPostData)}
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
           
          posts={longformPosts as unknown as LongFormPostType[]}
          type="scheduled"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user?.timezone ?? undefined}
          onPostSelect={(post) => {
             
            setSelectedLongFormPost(post as unknown as LongFormPostData);
          }}
          onEditPost={(post) => handleEditPost(post as PostData | LongFormPostData)}
          onReschedulePost={(post) => handleReschedulePost(post as PostData | LongFormPostData)}
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
           
          user={user ? (user as unknown as UserData) : undefined}
          queueTypes={queueTypes}
          hashTagPresets={Array.isArray(hashTagPresets) ? (hashTagPresets as { id: string; name: string; tags: string; description?: string | null }[]) : []}
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
    </div>
  );
}
