import {
  Outlet,
  useNavigate,
  useParams,
  useSearchParams,
} from "@remix-run/react";
import { useMemo } from "react";

import { Button } from "~/components/ui/button";
import {
  getLongFormDraftEditUrl,
  getShortDraftComposeUrl,
  isPollDraftPost,
  isShortPostDraftForPostsTab,
  isThreadDraftPost,
  useDraftsInfiniteData,
  useDraftsState,
} from "~/features/posts/drafts";
import type { DraftsHookPost } from "~/features/posts/hooks/useDraftsState";
import type {
  LongFormPostData,
  LongFormPostType,
  PostData,
} from "~/features/posts/server";
import type { CombinedContent } from "~/features/posts/types";
import {
  PublishingLibraryShell,
  PublishingPageHeader,
} from "~/features/posts/ui";
import { isRepostPost } from "~/features/posts/utils/content-helpers";
import { useInfiniteScrollSentinel } from "~/lib/hooks/useInfiniteScrollSentinel";
import { useIsMobile } from "~/lib/hooks/useIsMobile";

import { DraftsPageContent } from "./DraftsPageContent";

function convertPostDataToDraftsPost(postData: PostData): DraftsHookPost {
  const toIso = (d: Date | string | undefined) => {
    if (d instanceof Date) return d.toISOString();
    if (typeof d === "string") return d;
    return new Date().toISOString();
  };
  const hookPost: DraftsHookPost = {
    ...postData,
    createdAt: toIso(postData.createdAt as Date | string),
    updatedAt: toIso(postData.updatedAt as Date | string | undefined),
  };
  return hookPost;
}

export default function DraftsPage() {
  const navigate = useNavigate();
  const {
    posts,
    longformPosts,
    allContent,
    user,
    queueTypes,
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
  const postsCount = posts.filter((p) => isShortPostDraftForPostsTab(p)).length;
  const pollsCount = posts.filter((p) => isPollDraftPost(p)).length;
  const threadsCount = posts.filter((p) => isThreadDraftPost(p)).length;

  const {
    sortConfig,
    setSortConfig,
    searchTerm,
    selectedPosts,
    showAdvancedBulkResume,
    setShowAdvancedBulkResume,
    filteredPosts,
    bulkDeleteFetcher,
    bulkResumeFetcher,
    requestSort,
    setSearchTerm,
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

  const resumeShortDraft = (post: PostData) => {
    navigate(getShortDraftComposeUrl(post.id, post));
  };

  const resumeLongform = (post: LongFormPostData | LongFormPostType) => {
    navigate(getLongFormDraftEditUrl(post.id));
  };

  const latestDraft = useMemo((): CombinedContent | null => {
    if (allContent.length === 0) return null;
    return allContent.reduce((best, item) => {
      const t = item.updatedAt.getTime();
      const bt = best.updatedAt.getTime();
      return t > bt ? item : best;
    });
  }, [allContent]);

  const resumeLatestDraft = () => {
    if (!latestDraft) return;
    if (latestDraft.type === "post") {
      resumeShortDraft(latestDraft.originalData as PostData);
    } else {
      resumeLongform(latestDraft.originalData as LongFormPostData);
    }
  };

  if (isChildRoute) {
    return <Outlet />;
  }

  return (
    <PublishingLibraryShell>
      <div className="pt-2 pb-4">
        <PublishingPageHeader
          title="Drafts"
          subtitle="Resume unfinished posts, threads, polls, articles, and bulk drafts."
          actions={
            latestDraft && currentTab !== "bulk" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resumeLatestDraft}
              >
                Resume latest
              </Button>
            ) : null
          }
        />
      </div>

      <DraftsPageContent
        currentTab={currentTab}
        allContentLength={allContent.length}
        postsCount={postsCount}
        pollsCount={pollsCount}
        threadsCount={threadsCount}
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
        onResumeFromAll={(content) => {
          if (content.type === "post") {
            resumeShortDraft(content.originalData as PostData);
          } else {
            resumeLongform(content.originalData as LongFormPostData);
          }
        }}
        filteredPosts={filteredPosts}
        sortConfig={sortConfig}
        requestSort={requestSort}
        setSortConfig={setSortConfig}
        showAdvancedBulkResume={showAdvancedBulkResume}
        setShowAdvancedBulkResume={setShowAdvancedBulkResume}
        bulkResumeFetcherState={bulkResumeFetcher.state}
        onResumeShortDraft={(post) => {
          const full = posts.find((p) => p.id === post.id);
          if (full) {
            resumeShortDraft(full);
          }
        }}
        posts={posts}
        userTimezone={user?.timezone ?? undefined}
        userTimeFormat={userTimeFormat}
        longformPosts={longformPosts}
        onResumeLongform={resumeLongform}
        isMobile={isMobile}
        prefetchSentinelRef={prefetchSentinelRef}
        sentinelRef={sentinelRef}
        isFetchingNextPage={isFetchingNextPage}
        setScrollRoot={setScrollRoot}
      />

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
    </PublishingLibraryShell>
  );
}
