import { Outlet, useParams, useSearchParams } from "@remix-run/react";
import { useState } from "react";

import type {
  CombinedContent,
  LongFormPostData,
  PostData,
} from "~/features/posts/server";
import {
  AllContentListing,
  DraftBulkResume,
  DraftsBulkActions,
  DraftsHeader,
  DraftsPostTypeTabs,
  DraftsTable,
  LongFormDetailsModal,
  LongFormListing,
  PostDetailsModal,
  PostsSearch,
  QueueSelectionTabs,
  useDraftsData,
  useDraftsState,
} from "~/features/posts/ui";
import { convertDraftsPostsToPostDataArray } from "~/lib/validation/drafts-post-conversion";

export default function DraftsPage() {
  const [selectedLongFormPost, setSelectedLongFormPost] =
    useState<LongFormPostData | null>(null);

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
    postData: PostData
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
  const isChildRoute = params["id"];

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
    posts: posts.map((post) => convertPostDataToDraftsPost(post)),
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
        queueType={params["queueType"]}
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
                  (c) => c.id === selectedPost.id
                );

                // PostDetailsModal accepts Post | PostData | CombinedContent
                const postToShow = postData ?? combinedContent ?? selectedPost;
                return (
                  <PostDetailsModal
                    post={postToShow as PostData | CombinedContent}
                    onClose={() => setSelectedPost(null)}
                    type="draft"
                    userTimezone={user?.timezone ?? undefined}
                  />
                );
              })()
            : null}

          {/* Bulk Edit */}
          {showAdvancedBulkResume ? (
            <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
              <DraftBulkResume
                selectedDrafts={convertDraftsPostsToPostDataArray(
                  filteredPosts.filter((post) => selectedPosts.has(post.id)),
                  posts
                )}
                queueTypes={queueTypes}
                onCancel={() => setShowAdvancedBulkResume(false)}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <LongFormListing
            posts={longformPosts}
            type="draft"
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            userTimezone={user?.timezone ?? undefined}
            onPostSelect={(post) => {
              setSelectedLongFormPost(post as LongFormPostData);
            }}
          />

          {selectedLongFormPost ? (
            <LongFormDetailsModal
              post={selectedLongFormPost}
              onClose={() => setSelectedLongFormPost(null)}
              type="draft"
              userTimezone={user?.timezone ?? undefined}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
