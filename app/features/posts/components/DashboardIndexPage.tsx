import {
  Link,
  useLoaderData,
  useNavigate,
  useNavigation,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { LongFormPostData, PostData } from "~/features/posts/server";
import type { CombinedContent, QueueType } from "~/features/posts/types";
import {
  ContentListPageHeader,
  EditPostModal,
  FlowView,
  LongFormDetailsModal,
  PostDetailsModal,
  QueueHealth,
  QueueSelectionTabs,
  RunwaySettingsModal,
  ScheduleNext7DaysCard,
  ScheduleOverviewTargetModal,
  SimpleRescheduleModal,
  Statistics,
  SuccessMessage,
  type FlowViewHandle,
  useFlowData,
} from "~/features/posts/ui";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useIsMobile } from "~/lib/hooks/useIsMobile";
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

/** Returns modal type for a flow item: "published" if already published, else "scheduled". */
function getFlowItemModalType(item: {
  publishedAt?: Date | string | null;
}): "published" | "scheduled" {
  const raw = item.publishedAt;
  const ts = raw ? new Date(raw).getTime() : 0;
  const nowMs = Date.now();
  return ts > 0 && ts <= nowMs ? "published" : "scheduled";
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

const DASHBOARD_TAB_ACTIVE_CLASSES =
  "border-border text-foreground dark:border-primary dark:text-primary";
const DASHBOARD_TAB_INACTIVE_CLASSES =
  "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

function DashboardContentTypeTabs({
  currentContentTab,
  queueType,
}: {
  currentContentTab: string;
  queueType: string;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile(768);
  const baseHref =
    queueType !== "all" ? `?queueType=${queueType}&tab=` : "?tab=";

  const handleMobileTabChange = (value: string) => {
    navigate(`/dashboard${baseHref}${value}`);
  };

  if (isMobile) {
    const label =
      currentContentTab === "all"
        ? "All Types"
        : currentContentTab === "posts"
          ? "Posts"
          : currentContentTab === "longform"
            ? "Articles"
            : "Reposts";
    return (
      <div className="min-w-0 flex-1">
        <Select value={currentContentTab} onValueChange={handleMobileTabChange}>
          <SelectTrigger
            className="h-9 border-0 border-b-2 border-transparent bg-transparent px-1 py-1.5 text-sm font-medium shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:ml-0"
            aria-label="Content type"
          >
            <SelectValue>{label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="posts">Posts</SelectItem>
            <SelectItem value="longform">Articles</SelectItem>
            <SelectItem value="reposts">Reposts</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  const tabClass = (tab: string) =>
    `border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
      currentContentTab === tab
        ? DASHBOARD_TAB_ACTIVE_CLASSES
        : DASHBOARD_TAB_INACTIVE_CLASSES
    }`;
  return (
    <div className="min-w-0 flex-1">
      <nav className="-mb-px flex space-x-6" aria-label="Content types">
        <Link to={`/dashboard${baseHref}all`} className={tabClass("all")}>
          All
        </Link>
        <Link to={`/dashboard${baseHref}posts`} className={tabClass("posts")}>
          Posts
        </Link>
        <Link
          to={`/dashboard${baseHref}longform`}
          className={tabClass("longform")}
        >
          Articles
        </Link>
        <Link
          to={`/dashboard${baseHref}reposts`}
          className={tabClass("reposts")}
        >
          Reposts
        </Link>
      </nav>
    </div>
  );
}

export default function DashboardIndexPage() {
  const {
    flowItems,
    hasMorePast,
    hasMoreFuture,
    lastScheduledAtUtc: lastScheduledAtUtcMs,
    user,
    queueTypes,
    hashTagPresets,
    runwaySettings,
    isLoadingMorePast,
    isLoadingMoreFuture,
    error: flowError,
    lastPrependedPastCount,
    clearPrependedPastCount,
    fetchMorePast,
    fetchMoreFuture,
  } = useFlowData();

  const [runwayModalOpen, setRunwayModalOpen] = useState(false);
  const [scheduleOverviewTargetModalOpen, setScheduleOverviewTargetModalOpen] =
    useState(false);

  const loaderData = useLoaderData<{
    queueCountsByQueue?: Array<{ queueName: string; count: number }>;
    scheduleNext7Days?: Array<{
      dateKey: string;
      count: number;
      byQueue?: Array<{ queueName: string; count: number }>;
    }>;
    runwaySettings?: { targetPostsPerDay?: number };
  }>();
  const queueCountsByQueue = Array.isArray(loaderData.queueCountsByQueue)
    ? loaderData.queueCountsByQueue
    : [];
  const scheduleNext7Days = Array.isArray(loaderData.scheduleNext7Days)
    ? loaderData.scheduleNext7Days
    : [];
  const targetPerDay =
    typeof loaderData.runwaySettings?.targetPostsPerDay === "number"
      ? loaderData.runwaySettings.targetPostsPerDay
      : 1;

  const { userTimeFormat } = useFormattedDate();
  const navigation = useNavigation();
  /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Remix types say location is set when loading; we keep optional for runtime */
  const isNavigatingToDashboard =
    navigation.state === "loading" &&
    (navigation.location?.pathname ?? "").split("?")[0] === "/dashboard";
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  const [searchParams] = useSearchParams();
  const queueType = searchParams.get("queueType") ?? "all";
  const currentContentTab = searchParams.get("tab") ?? "all";
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

  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setNowMs(Date.now());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Runway from server only (no fallback). When mode is "first-queue-empty" and any selected queue is empty, server returns null → show 0 days.
  const runwayDays = useMemo((): number | null => {
    const thenMs = lastScheduledAtUtcMs;
    if (thenMs == null || nowMs === null) return null;
    if (thenMs <= nowMs) return 0;
    return Math.ceil((thenMs - nowMs) / (24 * 60 * 60 * 1000));
  }, [lastScheduledAtUtcMs, nowMs]);

  /** For ContentListPageHeader (unused there; runway KPI uses runwayDays). */
  const _flowRunsUntil = useMemo((): Date | null => {
    const ms =
      lastScheduledAtUtcMs ??
      (() => {
        let latest = 0;
        for (const item of flowItems) {
          const at = item.scheduledAtUtc
            ? new Date(item.scheduledAtUtc).getTime()
            : 0;
          if (at > latest) latest = at;
        }
        return latest;
      })();
    return ms > 0 ? new Date(ms) : null;
  }, [lastScheduledAtUtcMs, flowItems]);

  const flowViewRef = useRef<FlowViewHandle | null>(null);
  const [_hasLiveEdge, setHasLiveEdge] = useState(false);
  const prevFilterRef = useRef<{
    tab: string;
    queue: string;
  } | null>(null);
  const pendingScrollToNextRef = useRef(false);

  // When user changes content tab or queue filter, mark that we should scroll after the new data loads
  useEffect(() => {
    const filterChanged =
      prevFilterRef.current !== null &&
      (prevFilterRef.current.tab !== currentContentTab ||
        prevFilterRef.current.queue !== queueType);
    prevFilterRef.current = { tab: currentContentTab, queue: queueType };
    if (filterChanged) {
      pendingScrollToNextRef.current = true;
    }
  }, [currentContentTab, queueType]);

  // When navigation (loader) completes after a filter change, request Flow to scroll to default once it has the new data
  useEffect(() => {
    if (navigation.state !== "idle" || !pendingScrollToNextRef.current) return;
    pendingScrollToNextRef.current = false;
    flowViewRef.current?.scrollToNextWhenReady();
  }, [navigation.state]);

  return (
    <>
      {showSuccessMessage && successMessage ? (
        <SuccessMessage
          message={successMessage}
          onDismiss={() => setShowSuccessMessage(false)}
        />
      ) : null}

      {/* Dashboard: top block (Statistics + Your Flow row), scrollable Flow section, bottom block (Queue Health + Top Posts) */}
      <div className="dashboard-canvas flex min-h-[calc(100dvh-12rem)] flex-1 flex-col lg:h-full lg:min-h-0">
        <div className="max-w-10xl mx-auto w-full flex-shrink-0 space-y-0 px-4 lg:px-8">
          <div className="mt-2.5">
            <Statistics
              runwayDays={runwayDays}
              onRunwayClick={() => setRunwayModalOpen(true)}
              runwayRedThresholdDays={runwaySettings?.redThresholdDays}
              runwayOrangeThresholdDays={runwaySettings?.orangeThresholdDays}
            />
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-3">
            <ContentListPageHeader pageType="flow" className="min-w-0" />
            {flowItems.length > 0 ? (
              <button
                type="button"
                onClick={() => flowViewRef.current?.scrollToNext()}
                className="text-muted-foreground hover:text-foreground focus:ring-ring flex-shrink-0 rounded text-xs underline focus:ring-2 focus:outline-none"
                aria-label="Scroll timeline to next posts or schedule"
              >
                Scroll to next
              </button>
            ) : null}
          </div>
          <div className="border-border mt-2 flex flex-row items-end justify-between gap-2 border-b">
            <DashboardContentTypeTabs
              currentContentTab={currentContentTab}
              queueType={queueType}
            />
            <QueueSelectionTabs
              currentTab="all"
              queueTypes={queueTypesFiltered}
              basePath="/dashboard"
            />
          </div>
        </div>

        {/* Flow section: scrollable area between Your Flow heading and Queue Health / Top Posts */}
        <div className="flow-zone bg-muted/40 dark:bg-muted/20 mt-4 flex min-h-[264px] flex-1 flex-col justify-center overflow-y-auto py-4 md:min-h-[300px]">
          {flowError ? (
            <Alert
              variant="destructive"
              className="mx-4 flex flex-col gap-2 lg:mx-8"
            >
              <AlertDescription className="flex flex-col gap-2">
                <span className="font-medium">{flowError.message}</span>
                <button
                  type="button"
                  onClick={() => revalidator.revalidate()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring w-fit rounded-md px-3 py-1.5 text-sm font-medium focus:ring-2 focus:outline-none"
                >
                  Retry
                </button>
              </AlertDescription>
            </Alert>
          ) : null}

          {flowError ? null : isNavigatingToDashboard &&
            flowItems.length === 0 ? (
            <div
              className="border-border-subtle mx-4 flex h-[160px] w-full items-center justify-center rounded-xl border border-dashed p-8 lg:mx-8"
              role="status"
              aria-label="Loading timeline"
              aria-live="polite"
            >
              <p className="text-muted-foreground text-sm">Loading timeline…</p>
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-col">
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
                lastPrependedPastCount={lastPrependedPastCount}
                onPrependedPastCompensated={clearPrependedPastCount}
                onHasLiveEdgeChange={setHasLiveEdge}
              />
            </div>
          )}
        </div>

        <div className="max-w-10xl mx-auto mt-6 w-full flex-shrink-0 px-4 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
            <ScheduleNext7DaysCard
              days={scheduleNext7Days}
              targetPerDay={targetPerDay}
              userTimezone={getUserTimezone(user)}
              onOpenTargetModal={() => setScheduleOverviewTargetModalOpen(true)}
              queueTypes={queueTypesFiltered}
            />
            <QueueHealth
              queueCounts={queueCountsByQueue}
              queueTypes={queueTypesFiltered}
            />
          </div>
        </div>
      </div>

      <RunwaySettingsModal
        open={runwayModalOpen}
        onOpenChange={setRunwayModalOpen}
        queueTypes={queueTypesFiltered}
        runwaySettings={runwaySettings ?? undefined}
        onSuccess={() => revalidator.revalidate()}
      />

      <ScheduleOverviewTargetModal
        key={
          scheduleOverviewTargetModalOpen ? `open-${targetPerDay}` : "closed"
        }
        open={scheduleOverviewTargetModalOpen}
        onClose={() => setScheduleOverviewTargetModalOpen(false)}
        targetPerDay={targetPerDay}
        onSuccess={() => revalidator.revalidate()}
      />

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onDeleted={() => revalidator.revalidate()}
          onEdit={(p) => {
            setSelectedPost(null);
            _handleEditPost(p as PostData);
          }}
          onReschedule={(p) => {
            setSelectedPost(null);
            _handleReschedulePost(p as PostData);
          }}
          showSignedEvent={true}
          type={getFlowItemModalType(selectedPost)}
          userTimezone={getUserTimezone(user)}
          userTimeFormat={userTimeFormat}
        />
      ) : null}

      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          onClose={() => setSelectedLongFormPost(null)}
          onDeleted={() => revalidator.revalidate()}
          onEdit={(p) => {
            setSelectedLongFormPost(null);
            _handleEditPost(p as LongFormPostData);
          }}
          onReschedule={(p) => {
            setSelectedLongFormPost(null);
            _handleReschedulePost(p as LongFormPostData);
          }}
          type={getFlowItemModalType(selectedLongFormPost)}
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
