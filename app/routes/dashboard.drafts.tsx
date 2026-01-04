import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import {
  useParams,
  Outlet,
  useSearchParams,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  handleDraftsAction,
  loadDraftsData,
  type PostData,
  type CombinedContent,
  type LongFormPostType as _LongFormPostType,
} from "~/features/posts/server";
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
  useDraftsData,
} from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";
import { convertDraftsPostsToPostDataArray } from "~/lib/validation/drafts-post-conversion.server";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { draftsLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to the drafts feature
    await requireFeatureAccess(userId, "drafts");

    const queueType = params.queueType ?? "all";

    const data = await loadDraftsData(userId, queueType);
    
    // Validate loader response with Zod schema
    return validateLoaderResponse(data, draftsLoaderDataSchema);
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
    const result = await handleDraftsAction(formData, userId);

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

export default function DraftPosts() {
  // Use TanStack Query for data fetching with caching
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    selectedQueueType: _selectedQueueType,
    isLoading: _isDataLoading,
  } = useDraftsData();

  // Conversion function: PostData -> Post (for useDraftsState hook)
  // useDraftsState expects Post with createdAt: string
  const convertPostDataToDraftsPost = (
    postData: PostData,
  ): {
    id: string;
    caption?: string | null;
    createdAt: string;
    [key: string]: unknown;
  } => {
    return {
      ...postData,
      createdAt:
        postData.createdAt instanceof Date
          ? postData.createdAt.toISOString()
          : typeof postData.createdAt === "string"
            ? postData.createdAt
            : new Date().toISOString(),
    };
  };

  const params = useParams();
  const [searchParams] = useSearchParams();

  // Check if we're on a child route (like edit)
  const isChildRoute = params.id;

  // Get current tab from URL params - default to "all"
  const currentTab = searchParams.get("tab") ?? "all";

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
    posts: posts.map(convertPostDataToDraftsPost),
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
              const originalPostData = posts.find((p) => p.id === post.id);
              if (originalPostData) {
                setSelectedPost(convertPostDataToDraftsPost(originalPostData));
              }
            }}
            bulkDeleteState={bulkDeleteFetcher.state}
          />

          {selectedPost
            ? (() => {
                const postData = posts.find((p) => p.id === selectedPost.id);
                const combinedContent = allContent.find(
                  (c) => c.id === selectedPost.id,
                );

                // Use type guards to safely determine post type
                // PostDetailsModal accepts Post | PostData | CombinedContent
                const postToShow = postData ?? combinedContent ?? selectedPost;
                return postToShow ? (
                  <PostDetailsModal
                    post={postToShow as PostData | CombinedContent}
                    onClose={() => setSelectedPost(null)}
                    type="draft"
                    userTimezone={user?.timezone ?? undefined}
                  />
                ) : null;
              })()
            : null}

          {/* Bulk Edit */}
          {showAdvancedBulkResume ? (
            <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
              <DraftBulkResume
                selectedDrafts={convertDraftsPostsToPostDataArray(
                  filteredPosts.filter((post) => selectedPosts.has(post.id)),
                  posts,
                )}
                queueTypes={queueTypes}
                onCancel={() => setShowAdvancedBulkResume(false)}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <LongFormListing
          posts={longformPosts}
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
