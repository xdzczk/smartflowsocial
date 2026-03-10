import { Outlet, useParams, useSearchParams } from "@remix-run/react";
import { useState } from "react";

import type {
  CombinedContent,
  LongFormPostData,
  PostData,
} from "~/features/posts/server";
import {
  ContentListPageHeader,
  LongFormDetailsModal,
  PostDetailsModal,
  useDraftsInfiniteData,
  useDraftsState,
} from "~/features/posts/ui";
import { isRepostPost } from "~/features/posts/utils/content-helpers";
import { useInfiniteScrollSentinel } from "~/lib/hooks/useInfiniteScrollSentinel";
import { useIsMobile } from "~/lib/hooks/useIsMobile";

import { DraftsPageContent } from "./DraftsPageContent";

function convertPostDataToDraftsPost(postData: PostData): {
  id: string;
  caption?: string | null;
  createdAt: string;
  [key: string]: unknown;
} {
  return {
    ...postData,
    createdAt:
      postData.createdAt instanceof Date
        ? postData.createdAt.toISOString()
        : typeof postData.createdAt === "string"
          ? postData.createdAt
          : new Date().toISOString(),
  };
}

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

  const params = useParams();
  const [searchParams] = useSearchParams();
  const isChildRoute = Boolean(params["id"]);
  const currentTab = searchParams.get("tab") ?? "all";

  const repostsCount = posts.filter((p) => isRepostPost(p)).length;
  const postsCount = posts.length - repostsCount;

  const {
    sortConfig,
    setSortConfig,
    searchTerm,
    setSearchTerm,
    selectedPost,
    selectedPosts,
    showAdvancedBulkResume,
    setShowAdvancedBulkResume,
    filteredPosts,
    bulkDeleteFetcher,
    bulkResumeFetcher,
    requestSort,
    setSelectedPost,
    togglePostSelection,
    toggleSelectAll,
    handleBulkDelete,
  } = useDraftsState({
    posts: posts.map((post) => convertPostDataToDraftsPost(post)),
    allContent: allContent.map((c) => ({ id: c.id, type: c.type })),
    currentTab,
  });

  const userTimeFormat =
    user && typeof user === "object" && "timeFormat" in user
      ? (user as { timeFormat?: string }).timeFormat === "24h"
        ? "24h"
        : "12h"
      : "12h";

  if (isChildRoute) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ContentListPageHeader pageType="drafts" currentTab={currentTab} />

      <DraftsPageContent
        currentTab={currentTab}
        allContentLength={allContent.length}
        postsCount={postsCount}
        repostsCount={repostsCount}
        longformCount={longformPosts.length}
        bulkCount={bulkDraftGroups.length}
        queueTypes={queueTypes}
        bulkDraftGroups={bulkDraftGroups}
        allContent={allContent}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedPosts={selectedPosts}
        togglePostSelection={togglePostSelection}
        toggleSelectAll={toggleSelectAll}
        handleBulkDelete={handleBulkDelete}
        bulkDeleteFetcherState={bulkDeleteFetcher.state}
        onPostSelectFromAll={(content) => {
          if (content.type === "post") {
            setSelectedPost(
              convertPostDataToDraftsPost(content.originalData as PostData)
            );
          } else {
            setSelectedLongFormPost(content.originalData as LongFormPostData);
          }
        }}
        filteredPosts={filteredPosts}
        sortConfig={sortConfig}
        requestSort={requestSort}
        setSortConfig={setSortConfig}
        showAdvancedBulkResume={showAdvancedBulkResume}
        setShowAdvancedBulkResume={setShowAdvancedBulkResume}
        bulkResumeFetcherState={bulkResumeFetcher.state}
        onPostClick={(post) => {
          const originalPostData = posts.find((p) => p.id === post.id);
          if (originalPostData) {
            setSelectedPost(convertPostDataToDraftsPost(originalPostData));
          }
        }}
        posts={posts}
        userTimezone={user?.timezone ?? undefined}
        userTimeFormat={userTimeFormat}
        longformPosts={longformPosts}
        onLongFormSelect={(post) =>
          setSelectedLongFormPost(post as LongFormPostData)
        }
        isMobile={isMobile}
        prefetchSentinelRef={prefetchSentinelRef}
        sentinelRef={sentinelRef}
        isFetchingNextPage={isFetchingNextPage}
        setScrollRoot={setScrollRoot}
      />

      {(currentTab === "all" || currentTab === "longform") &&
      selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
          type="draft"
          userTimezone={user?.timezone ?? undefined}
        />
      ) : null}

      {(currentTab === "all" ||
        currentTab === "posts" ||
        currentTab === "reposts") &&
      selectedPost ? (
        <PostDetailsModal
          post={
            (posts.find((p) => p.id === selectedPost.id) ??
              allContent.find((c) => c.id === selectedPost.id) ??
              selectedPost) as PostData | CombinedContent
          }
          onClose={() => setSelectedPost(null)}
          type="draft"
          userTimezone={user?.timezone ?? undefined}
        />
      ) : null}

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
}
