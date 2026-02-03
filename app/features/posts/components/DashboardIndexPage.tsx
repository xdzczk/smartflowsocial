import {
  useLoaderData,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { LongFormPostData, PostData } from "~/features/posts/server";
import type { CombinedContent, QueueType } from "~/features/posts/types";
import {
  DashboardHeader,
  EditPostModal,
  FlowView,
  LongFormDetailsModal,
  PostDetailsModal,
  QueueHealth,
  QueueSelectionTabs,
  SimpleRescheduleModal,
  Statistics,
  SuccessMessage,
  TopPostsList,
  type TopPostItemDTO,
  type FlowViewHandle,
  useFlowData,
} from "~/features/posts/ui";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  extractLongFormPostData,
  extractPostData,
} from "~/lib/validation/combined-content";
import { validateUserData } from "~/lib/validation/user-data";

function getUserTimezone(user: unknown): string | undefined {
  if (
    user &&
    typeof user === "object" &&
    "timezone" in user &&
    typeof user.timezone === "string"
  ) {
    return user.timezone;
  }
  return undefined;
}

function handleContentSelection(
  content: CombinedContent,
  setSelectedPost: (post: PostData | null) => void,
  setSelectedLongFormPost: (post: LongFormPostData | null) => void
): void {
  if (content.type === "post") {
    const postData = extractPostData(content);
    if (postData) {
      setSelectedPost(postData);
    }
  } else {
    const longFormData = extractLongFormPostData(content);
    if (longFormData) {
      setSelectedLongFormPost(longFormData);
    }
  }
}

export default function DashboardIndexPage() {
  const {
    flowItems,
    hasMorePast,
    hasMoreFuture,
    user,
    queueTypes,
    hashTagPresets,
    isLoadingMorePast,
    isLoadingMoreFuture,
    error: flowError,
    fetchMorePast,
    fetchMoreFuture,
  } = useFlowData();

  const loaderData = useLoaderData<{
    queueCountsByQueue?: Array<{ queueName: string; count: number }>;
    topPosts?: Array<{ post: unknown; stats: unknown }>;
    topPostsTimeframe?: number;
  }>();
  const queueCountsByQueue = Array.isArray(loaderData.queueCountsByQueue)
    ? loaderData.queueCountsByQueue
    : [];
  const topPosts = Array.isArray(loaderData.topPosts)
    ? loaderData.topPosts
    : [];
  const topPostsTimeframe =
    typeof loaderData.topPostsTimeframe === "number"
      ? loaderData.topPostsTimeframe
      : 7;

  const { userTimeFormat } = useFormattedDate();
  const navigation = useNavigation();
  /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Remix types say location is set when loading; we keep optional for runtime */
  const isNavigatingToDashboard =
    navigation.state === "loading" &&
    (navigation.location?.pathname ?? "").split("?")[0] === "/dashboard";
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  const [searchParams] = useSearchParams();
  const planActivated = searchParams.get("planActivated");
  const successMessage = searchParams.get("message");
  const [showSuccessMessage, setShowSuccessMessage] = useState(
    !!(planActivated && typeof planActivated === "string")
  );

  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [selectedLongFormPost, setSelectedLongFormPost] =
    useState<LongFormPostData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [postToEdit, setPostToEdit] = useState<
    PostData | LongFormPostData | null
  >(null);
  const [postToReschedule, setPostToReschedule] = useState<
    PostData | LongFormPostData | null
  >(null);

  const _handleEditPost = (post: PostData | LongFormPostData) => {
    setPostToEdit(post);
    setShowEditModal(true);
  };

  const _handleReschedulePost = (post: PostData | LongFormPostData) => {
    setPostToReschedule(post);
    setShowRescheduleModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setPostToEdit(null);
  };

  const handleCloseRescheduleModal = () => {
    setShowRescheduleModal(false);
    setPostToReschedule(null);
  };

  const revalidator = useRevalidator();

  // Revalidate every minute so relative times stay fresh and newly posted items move to "Last posted" in real time
  useEffect(() => {
    if (flowItems.length === 0) return;
    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revalidator identity can change; we only want one interval per flowItems.length
  }, [flowItems.length]);

  const handleModalSuccess = () => {
    handleCloseEditModal();
    handleCloseRescheduleModal();
    setSelectedPost(null);
    setSelectedLongFormPost(null);
    revalidator.revalidate();
  };

  useEffect(() => {
    if (showSuccessMessage) {
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMessage]);

  const queueTypesFiltered: QueueType[] = Array.isArray(queueTypes)
    ? (queueTypes as QueueType[])
    : [];
  const hashTagPresetsArray = Array.isArray(hashTagPresets)
    ? (hashTagPresets as Parameters<typeof EditPostModal>[0]["hashTagPresets"])
    : [];

  const flowRunsUntil = useMemo(() => {
    let latest: Date | null = null;
    for (const item of flowItems) {
      const at = item.scheduledAtUtc
        ? new Date(item.scheduledAtUtc).getTime()
        : 0;
      if (at > 0 && (!latest || at > latest.getTime())) {
        latest = new Date(at);
      }
    }
    return latest;
  }, [flowItems]);

  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setNowMs(Date.now());
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const runwayDays = useMemo((): number | null => {
    if (!flowRunsUntil || nowMs === null) return null;
    const then = flowRunsUntil.getTime();
    if (then <= nowMs) return null;
    return Math.ceil((then - nowMs) / (24 * 60 * 60 * 1000));
  }, [flowRunsUntil, nowMs]);

  const flowViewRef = useRef<FlowViewHandle | null>(null);
  const [hasLiveEdge, setHasLiveEdge] = useState(false);

  return (
    <>
      {showSuccessMessage && successMessage ? (
        <SuccessMessage
          message={successMessage}
          onDismiss={() => setShowSuccessMessage(false)}
        />
      ) : null}

      {/* Dashboard spacing: Flow as working surface (bg-muted/dark:bg-card, no box); Flow container mt-8 pt-2 pb-8, bottom row mt-16 */}
      <div className="flex min-h-[calc(100dvh-12rem)] flex-col lg:h-full lg:min-h-0">
        <div className="flex-shrink-0 space-y-0">
          <div className="mt-2.5">
            <Statistics runwayDays={runwayDays} />
          </div>
          <div className="min-h-[1.5rem] flex-1" aria-hidden />
          <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <DashboardHeader
                currentTab="all"
                allContentCount={flowItems.length}
                postsCount={flowItems.filter((i) => i.type === "post").length}
                longformCount={
                  flowItems.filter((i) => i.type === "longform").length
                }
                flowRunsUntil={flowRunsUntil}
                className="min-w-0"
              />
              {hasLiveEdge ? (
                <button
                  type="button"
                  onClick={() => flowViewRef.current?.scrollToNext()}
                  className="text-muted-foreground hover:text-foreground focus:ring-primary flex-shrink-0 rounded text-xs underline focus:ring-2 focus:ring-offset-2 focus:outline-none"
                  aria-label="Scroll timeline to next posts"
                >
                  Scroll to next
                </button>
              ) : null}
            </div>
            <div className="min-w-0 justify-self-end">
              <QueueSelectionTabs
                currentTab="all"
                queueTypes={queueTypesFiltered}
                basePath="/dashboard"
              />
            </div>
          </div>
        </div>

        <div className="border-border bg-muted/90 dark:bg-card mt-8 flex min-h-0 flex-1 flex-col rounded-xl border pt-2 pb-8 shadow-sm dark:shadow-none">
          {flowError ? (
            <div
              className="border-destructive bg-destructive/10 flex flex-col gap-2 rounded-lg border p-4"
              role="alert"
            >
              <p className="text-destructive text-sm font-medium">
                {flowError.message}
              </p>
              <button
                type="button"
                onClick={() => revalidator.revalidate()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary w-fit rounded-md px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:outline-none"
              >
                Retry
              </button>
            </div>
          ) : null}

          {flowError ? null : isNavigatingToDashboard &&
            flowItems.length === 0 ? (
            <div
              className="border-border flex h-[160px] w-full items-center justify-center rounded-lg border border-dashed p-8"
              role="status"
              aria-label="Loading timeline"
              aria-live="polite"
            >
              <p className="text-muted-foreground text-sm">Loading timeline…</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <FlowView
                ref={flowViewRef}
                flowItems={flowItems}
                hasMorePast={hasMorePast}
                hasMoreFuture={hasMoreFuture}
                isLoadingMorePast={isLoadingMorePast}
                isLoadingMoreFuture={isLoadingMoreFuture}
                onCardClick={(item) =>
                  handleContentSelection(
                    item,
                    setSelectedPost,
                    setSelectedLongFormPost
                  )
                }
                onFetchMorePast={fetchMorePast}
                onFetchMoreFuture={fetchMoreFuture}
                onHasLiveEdgeChange={setHasLiveEdge}
              />
            </div>
          )}
        </div>

        <div className="mt-16 flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-4 lg:overflow-y-auto">
          <QueueHealth
            queueCounts={queueCountsByQueue}
            queueTypes={queueTypesFiltered}
          />
          <TopPostsList
            topPosts={topPosts as TopPostItemDTO[]}
            timeframeDays={topPostsTimeframe}
            userTimezone={getUserTimezone(user)}
          />
        </div>
      </div>

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          showSignedEvent={true}
          type="scheduled"
          userTimezone={getUserTimezone(user)}
          userTimeFormat={userTimeFormat}
        />
      ) : null}

      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
          type="scheduled"
          showSignedEvent={true}
          userTimezone={getUserTimezone(user)}
          userTimeFormat={userTimeFormat}
        />
      ) : null}

      {showEditModal && postToEdit ? (
        <EditPostModal
          post={postToEdit}
          onClose={handleCloseEditModal}
          onConfirm={handleModalSuccess}
          user={user ? (validateUserData(user) ?? undefined) : undefined}
          queueTypes={queueTypesFiltered}
          hashTagPresets={hashTagPresetsArray}
        />
      ) : null}

      {showRescheduleModal && postToReschedule ? (
        <SimpleRescheduleModal
          post={postToReschedule}
          onClose={handleCloseRescheduleModal}
          onConfirm={handleModalSuccess}
          user={user ? (validateUserData(user) ?? undefined) : undefined}
          queueTypes={queueTypesFiltered}
          userTimeFormat={userTimeFormat}
        />
      ) : null}
    </>
  );
}
