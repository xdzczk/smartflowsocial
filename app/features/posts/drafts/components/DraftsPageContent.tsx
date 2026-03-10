import type {
  CombinedContent,
  LongFormPostData,
  PostData,
} from "~/features/posts/server";
import type { QueueType } from "~/features/posts/types";
import type { LongFormPostType } from "~/features/posts/ui";
import {
  AllContentListing,
  BulkDraftsListing,
  DraftBulkResume,
  DraftsBulkActions,
  DraftsTable,
  LongFormListing,
  PostTypeTabs,
  QueueSelectionTabs,
} from "~/features/posts/ui";
import { convertDraftsPostsToPostDataArray } from "~/lib/validation/drafts-post-conversion";
import type { DraftsStatePost } from "~/lib/validation/drafts-post-conversion";

export interface DraftsPageContentProps {
  currentTab: string;
  allContentLength: number;
  postsCount: number;
  repostsCount: number;
  longformCount: number;
  bulkCount: number;
  queueTypes: QueueType[];
  bulkDraftGroups: Array<{ id: string; postCount: number; updatedAt: string }>;
  // allContent listing
  allContent: unknown[];
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  selectedPosts: Set<string>;
  togglePostSelection: (id: string) => void;
  toggleSelectAll: () => void;
  handleBulkDelete: () => void;
  bulkDeleteFetcherState: string;
  onPostSelectFromAll: (content: {
    type: string;
    originalData: unknown;
  }) => void;
  // posts/reposts table
  filteredPosts: DraftsStatePost[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  requestSort: (key: string) => void;
  setSortConfig: (c: { key: string; direction: "asc" | "desc" }) => void;
  showAdvancedBulkResume: boolean;
  setShowAdvancedBulkResume: (v: boolean) => void;
  bulkResumeFetcherState: string;
  onPostClick: (post: { id: string }) => void;
  posts: PostData[];
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  // longform
  longformPosts: LongFormPostData[];
  onLongFormSelect: (post: LongFormPostData | LongFormPostType) => void;
  // scroll
  isMobile: boolean;
  prefetchSentinelRef: React.Ref<HTMLDivElement | null>;
  sentinelRef: React.Ref<HTMLDivElement | null>;
  isFetchingNextPage: boolean;
  setScrollRoot: ((el: HTMLDivElement | null) => void) | undefined;
}

export function DraftsPageContent({
  currentTab,
  allContentLength,
  postsCount,
  repostsCount,
  longformCount,
  bulkCount,
  queueTypes,
  bulkDraftGroups,
  allContent,
  searchTerm,
  setSearchTerm,
  selectedPosts,
  togglePostSelection,
  toggleSelectAll,
  handleBulkDelete,
  bulkDeleteFetcherState,
  onPostSelectFromAll,
  filteredPosts,
  sortConfig,
  requestSort,
  setSortConfig,
  showAdvancedBulkResume,
  setShowAdvancedBulkResume,
  bulkResumeFetcherState,
  onPostClick,
  posts,
  userTimezone,
  userTimeFormat = "12h",
  longformPosts,
  onLongFormSelect,
  isMobile,
  prefetchSentinelRef,
  sentinelRef,
  isFetchingNextPage,
  setScrollRoot,
}: DraftsPageContentProps) {
  const showQueueTabs =
    currentTab === "all" ||
    currentTab === "posts" ||
    currentTab === "reposts" ||
    currentTab === "longform";

  if (currentTab === "bulk") {
    return (
      <>
        <div className="border-border mb-6 flex flex-row flex-nowrap items-end gap-2 border-b">
          <PostTypeTabs
            currentTab={currentTab}
            basePath="/dashboard/drafts"
            totalContentCount={allContentLength}
            totalPostsCount={postsCount}
            totalRepostsCount={repostsCount}
            totalLongformCount={longformCount}
            bulkCount={bulkCount}
            inRow
          />
          {showQueueTabs ? (
            <QueueSelectionTabs
              currentTab={currentTab}
              queueTypes={queueTypes}
              basePath="/dashboard/drafts"
            />
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <BulkDraftsListing groups={bulkDraftGroups} />
        </div>
      </>
    );
  }

  if (currentTab === "all") {
    return (
      <>
        <div className="border-border mb-6 flex flex-row flex-nowrap items-end gap-2 border-b">
          <PostTypeTabs
            currentTab={currentTab}
            basePath="/dashboard/drafts"
            totalContentCount={allContentLength}
            totalPostsCount={postsCount}
            totalRepostsCount={repostsCount}
            totalLongformCount={longformCount}
            bulkCount={bulkCount}
            inRow
          />
          {showQueueTabs ? (
            <QueueSelectionTabs
              currentTab={currentTab}
              queueTypes={queueTypes}
              basePath="/dashboard/drafts"
            />
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <AllContentListing
            content={allContent as CombinedContent[]}
            type="draft"
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            userTimezone={userTimezone}
            onPostSelect={onPostSelectFromAll}
            selectedItems={selectedPosts}
            onToggleSelection={togglePostSelection}
            onToggleSelectAll={toggleSelectAll}
            showBulkActions={true}
            onBulkDelete={handleBulkDelete}
            bulkDeleteState={bulkDeleteFetcherState}
            prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
            sentinelRef={isMobile ? sentinelRef : undefined}
            isFetchingNextPage={isFetchingNextPage}
            onScrollContainerReady={isMobile ? setScrollRoot : undefined}
          />
        </div>
      </>
    );
  }

  if (currentTab === "posts" || currentTab === "reposts") {
    return (
      <>
        <div className="border-border mb-6 flex flex-row flex-nowrap items-end gap-2 border-b">
          <PostTypeTabs
            currentTab={currentTab}
            basePath="/dashboard/drafts"
            totalContentCount={allContentLength}
            totalPostsCount={postsCount}
            totalRepostsCount={repostsCount}
            totalLongformCount={longformCount}
            bulkCount={bulkCount}
            inRow
          />
          {showQueueTabs ? (
            <QueueSelectionTabs
              currentTab={currentTab}
              queueTypes={queueTypes}
              basePath="/dashboard/drafts"
            />
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <DraftsBulkActions
            selectedCount={selectedPosts.size}
            onBulkEdit={() => setShowAdvancedBulkResume(true)}
            onBulkDelete={handleBulkDelete}
            isDeleting={bulkDeleteFetcherState !== "idle"}
            isResuming={bulkResumeFetcherState !== "idle"}
          />
          <DraftsTable
            posts={filteredPosts}
            sortConfig={sortConfig}
            onRequestSort={requestSort}
            selectedPosts={selectedPosts}
            onToggleSelection={togglePostSelection}
            onToggleSelectAll={toggleSelectAll}
            onPostClick={onPostClick}
            bulkDeleteState={bulkDeleteFetcherState}
            userTimezone={userTimezone}
            userTimeFormat={userTimeFormat}
            onSortChange={(key, direction) => setSortConfig({ key, direction })}
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
      </>
    );
  }

  return (
    <>
      <div className="border-border mb-6 flex flex-row flex-nowrap items-end gap-2 border-b">
        <PostTypeTabs
          currentTab={currentTab}
          basePath="/dashboard/drafts"
          totalContentCount={allContentLength}
          totalPostsCount={postsCount}
          totalRepostsCount={repostsCount}
          totalLongformCount={longformCount}
          bulkCount={bulkCount}
          inRow
        />
        {showQueueTabs ? (
          <QueueSelectionTabs
            currentTab={currentTab}
            queueTypes={queueTypes}
            basePath="/dashboard/drafts"
          />
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <LongFormListing
          posts={longformPosts}
          type="draft"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={userTimezone}
          onPostSelect={onLongFormSelect}
          prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
          sentinelRef={isMobile ? sentinelRef : undefined}
          isFetchingNextPage={isFetchingNextPage}
          onScrollContainerReady={isMobile ? setScrollRoot : undefined}
        />
      </div>
    </>
  );
}
