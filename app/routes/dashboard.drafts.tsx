import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useParams,
  Outlet,
  useSearchParams,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import {
  AllContentListing,
  DraftBulkResume,
  DraftsBulkActions,
  DraftsHeader,
  DraftsPostTypeTabs,
  DraftsTable,
  LongFormListing,
  PostDetailsModal,
  PostsSearch,
  QueueSelectionTabs,
  useDraftsState,
  handleDraftsAction,
  loadDraftsData,
  type PostData,
  type LongFormPostData,
  type CombinedContent,
  type QueueType,
  type UserData,
  convertJsonValueToScheduleConfig,
} from "~/features/posts";
import { withErrorHandling, withActionErrorHandling } from "~/lib/error-handler.server";
import type { LongFormPostType } from "~/features/posts";

async function loaderImpl({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to the drafts feature
  await requireFeatureAccess(userId, "drafts");

  const queueType = params.queueType || "all";

  const data = await loadDraftsData(userId, queueType);
  return data;
}

export const loader = withErrorHandling(loaderImpl);

export const action = withActionErrorHandling(async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const result = await handleDraftsAction(formData, userId);
  
  if (result.error) {
    return json(result, { status: 400 });
  }
  
  return json(result);
});

type LoaderData = Awaited<ReturnType<typeof loaderImpl>>;

export default function DraftPosts() {
  const data = useLoaderData<LoaderData>();
  const postsRaw = "posts" in data && Array.isArray(data.posts) ? data.posts : [];
  const longformPostsRaw = "longformPosts" in data && Array.isArray(data.longformPosts) ? data.longformPosts : [];
  const allContentRaw = "allContent" in data && Array.isArray(data.allContent) ? data.allContent : [];
  const userRaw = "user" in data ? data.user : null;
  const queueTypesRaw = "queueTypes" in data && Array.isArray(data.queueTypes) ? data.queueTypes : [];

  // Type assertions for Remix JsonifyObject serialization
  // Remix serializes Date objects to strings, so we need to assert these types
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const posts: PostData[] = Array.isArray(postsRaw) ? (postsRaw as unknown as PostData[]) : [];
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const longformPosts: LongFormPostData[] = Array.isArray(longformPostsRaw) ? (longformPostsRaw as unknown as LongFormPostData[]) : [];
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const allContent: CombinedContent[] = Array.isArray(allContentRaw) ? (allContentRaw as unknown as CombinedContent[]) : [];
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const user: UserData | null | undefined = userRaw ? (userRaw as unknown as UserData) : null;

  // Conversion function: PostData -> Post (for useDraftsState hook)
  // useDraftsState expects Post with createdAt: string
  const convertPostDataToDraftsPost = (postData: PostData): { id: string; caption?: string | null; createdAt: string; [key: string]: unknown } => {
    return {
      ...postData,
      createdAt: postData.createdAt instanceof Date ? postData.createdAt.toISOString() : typeof postData.createdAt === "string" ? postData.createdAt : new Date().toISOString(),
    };
  };
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
  const params = useParams();
  const [searchParams] = useSearchParams();

  // Check if we're on a child route (like edit)
  const isChildRoute = params.id;

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") || "all";

  const {
    sortConfig,
    searchTerm,
    selectedPost,
    selectedPosts,
    showAdvancedBulkResume,
    filteredPosts,
    bulkDeleteFetcher,
    bulkResumeFetcher,
    requestSort,
    setSearchTerm,
    setSelectedPost,
    togglePostSelection,
    toggleSelectAll,
    handleBulkDelete,
    setShowAdvancedBulkResume,
  } = useDraftsState({ 
    posts: posts.map(convertPostDataToDraftsPost)
  });

  // If we're on a child route, render the child component
  if (isChildRoute) {
    return <Outlet />;
  }

  return (
    <div>
      <DraftsHeader
        currentTab={currentTab}
        allContentCount={allContent.length}
        postsCount={filteredPosts.length}
        longformCount={longformPosts.length}
      />

      {/* Post Type Tabs */}
      <DraftsPostTypeTabs
        currentTab={currentTab}
        allContentCount={allContent.length}
        postsCount={filteredPosts.length}
        longformCount={longformPosts.length}
        queueType={params.queueType}
      />

      {/* Queue Selection Tabs */}
      {currentTab === "all" ||
      currentTab === "posts" ||
      currentTab === "longform" ? (
        <QueueSelectionTabs
          currentTab={currentTab}
          queueTypes={queueTypes}
          basePath="/dashboard/drafts"
        />
      ) : null}

      {/* Content based on current tab */}
      {currentTab === "all" ? (
        <AllContentListing
          content={allContent}
          type="draft"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user?.timezone ?? undefined}
          onPostSelect={(content) => {
            if (content.type === "post") {
              const postData = content.originalData as PostData;
              setSelectedPost(convertPostDataToDraftsPost(postData));
            }
          }}
          selectedItems={selectedPosts}
          onToggleSelection={togglePostSelection}
          onToggleSelectAll={toggleSelectAll}
          showBulkActions={true}
          onBulkDelete={handleBulkDelete}
          bulkDeleteState={bulkDeleteFetcher.state}
        />
      ) : currentTab === "posts" ? (
        <div>
          <PostsSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />

          <DraftsBulkActions
            selectedCount={selectedPosts.size}
            onBulkEdit={() => setShowAdvancedBulkResume(true)}
            onBulkDelete={handleBulkDelete}
            isDeleting={bulkDeleteFetcher.state !== "idle"}
            isResuming={bulkResumeFetcher.state !== "idle"}
          />

          <DraftsTable
            posts={filteredPosts}
            sortConfig={sortConfig}
            onRequestSort={requestSort}
            selectedPosts={selectedPosts}
            onToggleSelection={togglePostSelection}
            onToggleSelectAll={toggleSelectAll}
            onPostClick={(post) => {
              // Find the original PostData from posts array
              const originalPostData = posts.find(p => p.id === post.id);
              if (originalPostData) {
                setSelectedPost(convertPostDataToDraftsPost(originalPostData));
              }
            }}
            bulkDeleteState={bulkDeleteFetcher.state}
          />

          {selectedPost ? (() => {
            const postData = posts.find(p => p.id === selectedPost.id) as PostData | undefined;
            const combinedContent = allContent.find(c => c.id === selectedPost.id) as CombinedContent | undefined;
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const fallbackPost = selectedPost as unknown as PostData | CombinedContent;
            const postToShow = postData ?? combinedContent ?? fallbackPost;
            return postToShow ? (
              <PostDetailsModal
                post={postToShow}
                onClose={() => setSelectedPost(null)}
                type="draft"
                userTimezone={user?.timezone ?? undefined}
              />
            ) : null;
          })() : null}

          {/* Bulk Edit */}
          {showAdvancedBulkResume ? (
            <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
              <DraftBulkResume
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                selectedDrafts={filteredPosts.filter((post) =>
                  selectedPosts.has(post.id),
                ) as unknown as PostData[]}
                queueTypes={queueTypes}
                onCancel={() => setShowAdvancedBulkResume(false)}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <LongFormListing
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          posts={longformPosts as unknown as LongFormPostType[]}
          type="draft"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={user?.timezone ?? undefined}
          onPostSelect={(_post) => {
            // TODO: Add longform post detail modal here if needed
          }}
        />
      )}
    </div>
  );
}
