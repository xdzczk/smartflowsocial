import { useNavigate } from "@remix-run/react";

import {
  BulkDraftsListing,
  DraftBulkResume,
  DraftsBulkActions,
  DraftsTable,
  DraftsToolbar,
} from "~/features/posts/drafts";
import { LongFormListing } from "~/features/posts/longform";
import type {
  CombinedContent,
  LongFormPostData,
  LongFormPostType,
  PostData,
} from "~/features/posts/server";
import type { QueueType } from "~/features/posts/types";
import { AllContentListing } from "~/features/posts/ui";
import { convertDraftsPostsToPostDataArray } from "~/lib/validation/drafts-post-conversion";
import type { DraftsStatePost } from "~/lib/validation/drafts-post-conversion";

export interface DraftsPageContentProps {
  currentTab: string;
  allContentLength: number;
  postsCount: number;
  pollsCount: number;
  threadsCount: number;
  repostsCount: number;
  followUpsCount: number;
  longformCount: number;
  bulkCount: number;
  queueTypes: QueueType[];
  bulkDraftGroups: Array<{ id: string; postCount: number; updatedAt: string }>;
  allContent: unknown[];
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  selectedPosts: Set<string>;
  clearSelection: () => void;
  togglePostSelection: (id: string) => void;
  toggleSelectAll: () => void;
  handleBulkDelete: () => void;
  bulkDeleteFetcherState: string;
  onResumeFromAll: (content: { type: string; originalData: unknown }) => void;
  filteredPosts: DraftsStatePost[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  requestSort: (key: string) => void;
  setSortConfig: (c: { key: string; direction: "asc" | "desc" }) => void;
  showAdvancedBulkResume: boolean;
  setShowAdvancedBulkResume: (v: boolean) => void;
  bulkResumeFetcherState: string;
  onResumeShortDraft: (post: { id: string }) => void;
  posts: PostData[];
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  longformPosts: LongFormPostData[];
  onResumeLongform: (post: LongFormPostData | LongFormPostType) => void;
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
  pollsCount,
  threadsCount,
  repostsCount,
  followUpsCount,
  longformCount,
  bulkCount,
  queueTypes,
  bulkDraftGroups,
  allContent,
  searchTerm,
  setSearchTerm,
  selectedPosts,
  clearSelection,
  togglePostSelection,
  toggleSelectAll,
  handleBulkDelete,
  bulkDeleteFetcherState,
  onResumeFromAll,
  filteredPosts,
  sortConfig,
  requestSort,
  setSortConfig,
  showAdvancedBulkResume,
  setShowAdvancedBulkResume,
  bulkResumeFetcherState,
  onResumeShortDraft,
  posts,
  userTimezone,
  userTimeFormat = "12h",
  longformPosts,
  onResumeLongform,
  isMobile,
  prefetchSentinelRef,
  sentinelRef,
  isFetchingNextPage,
  setScrollRoot,
}: DraftsPageContentProps) {
  const navigate = useNavigate();

  const showQueueTabs =
    currentTab === "all" ||
    currentTab === "posts" ||
    currentTab === "polls" ||
    currentTab === "threads" ||
    currentTab === "reposts" ||
    currentTab === "followups" ||
    currentTab === "longform";

  const toolbarCounts = {
    totalContentCount: allContentLength,
    totalPostsCount: postsCount,
    totalPollsCount: pollsCount,
    totalThreadsCount: threadsCount,
    totalRepostsCount: repostsCount,
    totalFollowUpsCount: followUpsCount,
    totalLongformCount: longformCount,
    bulkCount,
  };

  const shortFormSortTabs =
    currentTab === "posts" ||
    currentTab === "reposts" ||
    currentTab === "followups" ||
    currentTab === "polls" ||
    currentTab === "threads";

  if (currentTab === "bulk") {
    return (
      <>
        <DraftsToolbar
          currentTab={currentTab}
          queueTypes={queueTypes}
          {...toolbarCounts}
          showQueueFilter={false}
          showSort={false}
          sortConfig={sortConfig}
          onSortChange={(key, direction) => setSortConfig({ key, direction })}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <BulkDraftsListing groups={bulkDraftGroups} />
        </div>
      </>
    );
  }

  if (currentTab === "all") {
    return (
      <>
        <DraftsToolbar
          currentTab={currentTab}
          queueTypes={queueTypes}
          {...toolbarCounts}
          showQueueFilter={showQueueTabs}
          showSort={false}
          sortConfig={sortConfig}
          onSortChange={(key, direction) => setSortConfig({ key, direction })}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <AllContentListing
            content={allContent as CombinedContent[]}
            type="draft"
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            userTimezone={userTimezone}
            onResumeDraft={onResumeFromAll}
            selectedItems={selectedPosts}
            onToggleSelection={togglePostSelection}
            onToggleSelectAll={toggleSelectAll}
            showBulkActions={true}
            onClearSelection={clearSelection}
            onBulkDelete={handleBulkDelete}
            bulkDeleteState={bulkDeleteFetcherState}
            prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
            sentinelRef={isMobile ? sentinelRef : undefined}
            isFetchingNextPage={isFetchingNextPage}
            onScrollContainerReady={isMobile ? setScrollRoot : undefined}
            queueTypes={queueTypes}
            onResetDraftFilters={() => {
              navigate("/dashboard/drafts?tab=all");
              setSearchTerm("");
            }}
          />
        </div>
      </>
    );
  }

  if (shortFormSortTabs) {
    return (
      <>
        <DraftsToolbar
          currentTab={currentTab}
          queueTypes={queueTypes}
          {...toolbarCounts}
          showQueueFilter={showQueueTabs}
          showSort={true}
          sortConfig={sortConfig}
          onSortChange={(key, direction) => setSortConfig({ key, direction })}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <DraftsBulkActions
            selectedCount={selectedPosts.size}
            onClearSelection={clearSelection}
            queueTypes={queueTypes}
            selectedPostIds={Array.from(selectedPosts)}
            filteredPosts={filteredPosts}
            onBulkReviewSchedule={() => setShowAdvancedBulkResume(true)}
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
            onResume={onResumeShortDraft}
            bulkDeleteState={bulkDeleteFetcherState}
            userTimezone={userTimezone}
            userTimeFormat={userTimeFormat}
            onSortChange={(key, direction) => setSortConfig({ key, direction })}
            prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
            sentinelRef={isMobile ? sentinelRef : undefined}
            isFetchingNextPage={isFetchingNextPage}
            onScrollContainerReady={isMobile ? setScrollRoot : undefined}
            showMobileSortControl={false}
          />
          {showAdvancedBulkResume ? (
            <div className="bg-canvas fixed inset-0 z-50">
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
      <DraftsToolbar
        currentTab={currentTab}
        queueTypes={queueTypes}
        {...toolbarCounts}
        showQueueFilter={showQueueTabs}
        showSort={false}
        sortConfig={sortConfig}
        onSortChange={(key, direction) => setSortConfig({ key, direction })}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <LongFormListing
          posts={longformPosts}
          type="draft"
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          userTimezone={userTimezone}
          onResumeDraft={onResumeLongform}
          prefetchSentinelRef={isMobile ? prefetchSentinelRef : undefined}
          sentinelRef={isMobile ? sentinelRef : undefined}
          isFetchingNextPage={isFetchingNextPage}
          onScrollContainerReady={isMobile ? setScrollRoot : undefined}
        />
      </div>
    </>
  );
}
