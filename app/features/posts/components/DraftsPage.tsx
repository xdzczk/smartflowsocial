import { Outlet, useParams, useSearchParams } from "@remix-run/react";
import { useState } from "react";

import type {
  CombinedContent,
  LongFormPostData,
  PostData,
} from "~/features/posts/server";
import {
  AllContentListing,
  BulkDraftsListing,
  DraftBulkResume,
  DraftsBulkActions,
  DraftsHeader,
  DraftsPostTypeTabs,
  DraftsTable,
  LongFormDetailsModal,
  LongFormListing,
  PostDetailsModal,
  QueueSelectionTabs,
  useDraftsInfiniteData,
  useDraftsState,
} from "~/features/posts/ui";
import { useInfiniteScrollSentinel } from "~/lib/hooks/useInfiniteScrollSentinel";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
import { convertDraftsPostsToPostDataArray } from "~/lib/validation/drafts-post-conversion";

/* eslint-disable sonarjs/cognitive-complexity -- Page orchestrator: tab content (all/posts/longform), modals, sentinel */
export default function DraftsPage() {
  const [selectedLongFormPost, setSelectedLongFormPost] =
    useState<LongFormPostData | null>(null);

  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
    selectedQueueType: _selectedQueueType,
    bulkDraftGroups,
    isLoading: _isDataLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useDraftsInfiniteData();

  const isMobile = useIsMobile(768);
  const { sentinelRef, prefetchSentinelRef, setScrollRoot } =
    useInfiniteScrollSentinel({
      isMobile,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage: () => {
        void fetchNextPage();
      },
    });

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
    setSortConfig,
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
    allContent: allContent.map((c) => ({ id: c.id, type: c.type })),
  });

  // If we're on a child route, render the child component
  if (isChildRoute) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen flex-col">
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
        bulkCount={bulkDraftGroups.length}
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

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Content based on current tab */}
        {currentTab === "bulk" ? (
          <BulkDraftsListing groups={bulkDraftGroups} />
        ) : currentTab === "all" ? (
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
              } else {
                setSelectedLongFormPost(
                  content.originalData as LongFormPostData
                );
              }
            }}
            selectedItems={selectedPosts}
            onToggleSelection={togglePostSelection}
            onToggleSelectAll={toggleSelectAll}
            showBulkActions={true}
            onBulkDelete={handleBulkDelete}
            bulkDeleteState={bulkDeleteFetcher.state}
            prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
            sentinelRef={isMobile ? sentinelRef : undefined}
            isFetchingNextPage={isFetchingNextPage}
            onScrollContainerReady={isMobile ? setScrollRoot : undefined}
          />
        ) : currentTab === "posts" ? (
          <div className="flex min-h-0 flex-1 flex-col">
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
                const originalPostData = posts.find((p) => p.id === post.id);
                if (originalPostData) {
                  setSelectedPost(
                    convertPostDataToDraftsPost(originalPostData)
                  );
                }
              }}
              bulkDeleteState={bulkDeleteFetcher.state}
              userTimezone={user?.timezone ?? undefined}
              userTimeFormat={
                user && typeof user === "object" && "timeFormat" in user
                  ? user.timeFormat === "24h"
                    ? "24h"
                    : "12h"
                  : "12h"
              }
              onSortChange={(key, direction) =>
                setSortConfig({ key, direction })
              }
              prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
              sentinelRef={isMobile ? sentinelRef : undefined}
              isFetchingNextPage={isFetchingNextPage}
              onScrollContainerReady={isMobile ? setScrollRoot : undefined}
            />

            {showAdvancedBulkResume ? (
              <div className="bg-background fixed inset-0 z-50">
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
              prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
              sentinelRef={isMobile ? sentinelRef : undefined}
              isFetchingNextPage={isFetchingNextPage}
              onScrollContainerReady={isMobile ? setScrollRoot : undefined}
            />
          </>
        )}
      </div>

      {/* Longform detail modal: show when a longform draft is selected (all or longform tab) */}
      {(currentTab === "all" || currentTab === "longform") &&
      selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
          type="draft"
          userTimezone={user?.timezone ?? undefined}
        />
      ) : null}

      {/* Short post detail modal: show when a draft post is selected (all or posts tab) */}
      {(currentTab === "all" || currentTab === "posts") && selectedPost
        ? (() => {
            const postData = posts.find((p) => p.id === selectedPost.id);
            const combinedContent = allContent.find(
              (c) => c.id === selectedPost.id
            );
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

      {/* Scroll sentinel for infinite scroll (desktop only; on mobile sentinels are inside listing scroll container) */}
      {!isMobile ? (
        <>
          <div ref={prefetchSentinelRef} className="h-4 w-full" />
          <div ref={sentinelRef} className="h-4 w-full" />
          {isFetchingNextPage ? (
            <div className="text-muted-foreground mt-4 text-center text-sm">
              Loading more drafts...
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
  /* eslint-enable sonarjs/cognitive-complexity */
}
