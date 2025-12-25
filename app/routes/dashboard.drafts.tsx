import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useParams,
  Outlet,
  useSearchParams,
  useRevalidator,
} from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import AllContentListing from "~/features/posts/components/AllContentListing";
import PostDetailsModal from "~/features/posts/components/PostDetailsModal";
import LongFormListing from "~/features/posts/components/LongFormListing";
import QueueSelectionTabs from "~/features/posts/components/QueueSelectionTabs";
import DraftBulkResume from "~/features/posts/components/DraftBulkResume";
import { DraftsHeader } from "~/features/posts/components/DraftsHeader";
import { DraftsPostTypeTabs } from "~/features/posts/components/DraftsPostTypeTabs";
import { DraftsTable } from "~/features/posts/components/DraftsTable";
import { DraftsBulkActions } from "~/features/posts/components/DraftsBulkActions";
import { PostsSearch } from "~/features/posts/components/PostsSearch";
import { useDraftsState } from "~/features/posts/hooks/useDraftsState";
import { loadDraftsData } from "~/features/posts/services/drafts-loader.server";
import { handleDraftsAction } from "~/features/posts/services/drafts-action.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to the drafts feature
  await requireFeatureAccess(userId, "drafts");

  const queueType = params.queueType || "all";

  const data = await loadDraftsData(userId, queueType);
  return json(data);
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const formData = await request.formData();
    const result = await handleDraftsAction(formData, userId);
    
    if (result.error) {
      return json(result, { status: 400 });
    }
    
    return json(result);
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

export default function DraftPosts() {
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    selectedQueueType,
  } = useLoaderData<typeof loader>();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const revalidator = useRevalidator();

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
  } = useDraftsState({ posts });

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
          userTimezone={user?.timezone}
          onPostSelect={(content) => {
            if (content.type === "post") {
              setSelectedPost(content.originalData);
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
            onPostClick={setSelectedPost}
            bulkDeleteState={bulkDeleteFetcher.state}
          />

          {selectedPost ? (
            <PostDetailsModal
              post={selectedPost as any}
              onClose={() => setSelectedPost(null)}
              type="draft"
              userTimezone={user?.timezone || undefined}
            />
          ) : null}

          {/* Bulk Edit */}
          {showAdvancedBulkResume ? (
            <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
              <DraftBulkResume
                selectedDrafts={filteredPosts.filter((post) =>
                  selectedPosts.has(post.id),
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
          userTimezone={user?.timezone}
          onPostSelect={(_post) => {
            // TODO: Add longform post detail modal here if needed
          }}
        />
      )}
    </div>
  );
}
