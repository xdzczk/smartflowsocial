import {
  useLoaderData,
  useNavigate,
  useNavigation,
  useRevalidator,
  useRouteLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { FirstRunDashboard } from "~/features/posts/components/FirstRunDashboard";
import { getLongFormPublishedEventId } from "~/features/posts/components/post-detail-modal/post-detail-helpers";
import { QueueTypeDialog } from "~/features/posts/components/QueueTypeDialog";
import { buildComposeEditUrl } from "~/features/posts/composer";
import { useDashboardDesktopLayoutHeights } from "~/features/posts/hooks/useDashboardDesktopLayoutHeights";
import type { UseFlowDataResult } from "~/features/posts/hooks/useFlowQuery";
import { usePostStatsQuery } from "~/features/posts/hooks/usePostStatsQuery";
import { LongFormDetailsModal } from "~/features/posts/longform";
import {
  RescheduleScheduledPostModal,
  ScheduleNext7DaysCard,
  ScheduleOverviewTargetModal,
} from "~/features/posts/scheduling";
import type { LongFormPostData, PostData } from "~/features/posts/server";
import type { PostStats } from "~/features/posts/stats.server";
import type { CombinedContent, QueueType } from "~/features/posts/types";
import {
  ContentListPageHeader,
  FlowView,
  PostDetailsModal,
  PublishingContentTypeFilter,
  PublishingQueueFilter,
  QueueHealth,
  RunwaySettingsModal,
  Statistics,
  SuccessMessage,
  buildDashboardContentTypeFilterItems,
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

function canAutoRevalidateDashboard(): boolean {
  if (typeof window === "undefined") return false;
  if (document.visibilityState !== "visible") return false;
  return navigator.onLine;
}

/** Softer selects in the Flow toolbar so “Your flow” stays the visual anchor (same h-9 footprint). */
const DASHBOARD_FLOW_FILTER_TRIGGER_CLASS =
  "text-body-sm font-medium shadow-none border-border/60 bg-surface-hover/15 hover:border-border hover:bg-surface-hover/35 dark:bg-surface-hover/10 dark:hover:bg-surface-hover/25";

function DashboardPlanSuccessMessage({
  show,
  message,
  onDismiss,
}: {
  show: boolean;
  message: string | null;
  onDismiss: () => void;
}) {
  if (!show || !message) return null;
  return <SuccessMessage message={message} onDismiss={onDismiss} />;
}

interface DashboardIndexLoaderData {
  queueCountsByQueue?: Array<{ queueName: string; count: number }>;
  isFirstRunDashboard?: boolean;
  dashboardActivity?: {
    hasDrafts?: boolean;
    hasScheduled?: boolean;
    hasPublished?: boolean;
    hasQueuesWithContent?: boolean;
  };
  scheduleNext7Days?: Array<{
    dateKey: string;
    count: number;
    byQueue?: Array<{ queueName: string; count: number }>;
  }>;
  runwaySettings?: { targetPostsPerDay?: number };
  serverNowMs?: number;
}

function useDashboardIndexLoaderDerived() {
  const loaderData = useLoaderData<DashboardIndexLoaderData>();
  const queueCountsByQueue = Array.isArray(loaderData.queueCountsByQueue)
    ? loaderData.queueCountsByQueue
    : [];
  const scheduleNext7Days = Array.isArray(loaderData.scheduleNext7Days)
    ? loaderData.scheduleNext7Days
    : [];
  const targetPerDay =
    typeof loaderData.runwaySettings?.targetPostsPerDay === "number"
      ? loaderData.runwaySettings.targetPostsPerDay
      : 0;
  const serverNowMs =
    typeof loaderData.serverNowMs === "number" && loaderData.serverNowMs > 0
      ? loaderData.serverNowMs
      : undefined;
  const isFirstRunDashboard = loaderData.isFirstRunDashboard === true;
  const dashboardActivity = {
    hasDrafts: loaderData.dashboardActivity?.hasDrafts === true,
    hasScheduled: loaderData.dashboardActivity?.hasScheduled === true,
    hasPublished: loaderData.dashboardActivity?.hasPublished === true,
    hasQueuesWithContent:
      loaderData.dashboardActivity?.hasQueuesWithContent === true,
  };
  const isPostActivationEmpty =
    !isFirstRunDashboard &&
    !dashboardActivity.hasScheduled &&
    !dashboardActivity.hasPublished &&
    !dashboardActivity.hasQueuesWithContent;

  return {
    queueCountsByQueue,
    scheduleNext7Days,
    targetPerDay,
    serverNowMs,
    isFirstRunDashboard,
    dashboardActivity,
    isPostActivationEmpty,
  };
}

function partitionFlowPostsForStats(flowItems: CombinedContent[]) {
  const postDataList: PostData[] = [];
  const longFormList: LongFormPostData[] = [];
  for (const item of flowItems) {
    if (item.type === "post") {
      const p = extractPostData(item);
      if (p) postDataList.push(p);
    } else {
      const lf = extractLongFormPostData(item);
      if (lf) longFormList.push(lf);
    }
  }
  return { postDataList, longFormList };
}

function computeRunwayDays(
  lastScheduledAtUtcMs: number | null | undefined,
  nowMs: number | null
): number | null {
  if (lastScheduledAtUtcMs == null || nowMs === null) return null;
  if (lastScheduledAtUtcMs <= nowMs) return 0;
  return Math.ceil((lastScheduledAtUtcMs - nowMs) / (24 * 60 * 60 * 1000));
}

function computeFlowRunsUntilDate(
  lastScheduledAtUtcMs: number | null | undefined,
  flowItems: CombinedContent[]
): Date | null {
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
}

interface PublishedFlowModalStats {
  likes: number;
  replies: number;
  mentions: number;
  reposts: number;
  zaps: number;
  satszapped: number;
}

function pickPublishedModalStats(
  entry: PostStats | undefined
): PublishedFlowModalStats | undefined {
  if (!entry) return;
  return {
    likes: entry.likes,
    replies: entry.replies,
    mentions: entry.mentions,
    reposts: entry.reposts,
    zaps: entry.zaps,
    satszapped: entry.satszapped,
  };
}

function statsForPublishedSelectedPost(
  selectedPost: PostData | null,
  flowStatsMerged: Record<string, PostStats>
): PublishedFlowModalStats | undefined {
  if (!selectedPost || getFlowItemModalType(selectedPost) !== "published") {
    return;
  }
  const se = selectedPost.signedEvent;
  if (!se || typeof se !== "object" || !("id" in se)) return;
  const id = (se as { id?: unknown }).id;
  if (typeof id !== "string") return;
  return pickPublishedModalStats(flowStatsMerged[id]);
}

function statsForPublishedSelectedLongForm(
  selectedLongFormPost: LongFormPostData | null,
  flowStatsMerged: Record<string, PostStats>
): PublishedFlowModalStats | undefined {
  if (
    !selectedLongFormPost ||
    getFlowItemModalType(selectedLongFormPost) !== "published"
  ) {
    return;
  }
  const eventId = getLongFormPublishedEventId(selectedLongFormPost);
  if (!eventId) return;
  return pickPublishedModalStats(flowStatsMerged[eventId]);
}

function useSelectedPublishedFlowModalStats(
  selectedPost: PostData | null,
  selectedLongFormPost: LongFormPostData | null,
  flowStatsMerged: Record<string, PostStats>
) {
  return useMemo(
    () => ({
      selectedPostModalStats: statsForPublishedSelectedPost(
        selectedPost,
        flowStatsMerged
      ),
      selectedLongFormModalStats: statsForPublishedSelectedLongForm(
        selectedLongFormPost,
        flowStatsMerged
      ),
    }),
    [selectedPost, selectedLongFormPost, flowStatsMerged]
  );
}

function useDashboardFlowScrollAfterFilter(
  currentContentTab: string,
  queueType: string,
  navigationState: string,
  flowViewRef: RefObject<FlowViewHandle | null>
) {
  const prevFilterRef = useRef<{ tab: string; queue: string } | null>(null);
  const pendingScrollToNextRef = useRef(false);

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

  useEffect(() => {
    if (navigationState !== "idle" || !pendingScrollToNextRef.current) return;
    pendingScrollToNextRef.current = false;
    flowViewRef.current?.scrollToNextWhenReady();
  }, [navigationState, flowViewRef]);
}

interface DashboardReturningUserSplitProps {
  runwayDays: number | null;
  runwaySettings: UseFlowDataResult["runwaySettings"];
  isPostActivationEmpty: boolean;
  onRunwayClick: () => void;
  splitRegionRef: RefObject<HTMLDivElement | null>;
  flowZoneHeightPx: number | undefined;
  lowerRowHeightPx: number | undefined;
  desktopFlowCardHeightPx: number | undefined;
  flowError: Error | null;
  onFlowRetry: () => void;
  isNavigatingToDashboard: boolean;
  flowItems: CombinedContent[];
  flowViewRef: RefObject<FlowViewHandle | null>;
  hasMorePast: boolean;
  hasMoreFuture: boolean;
  serverNowMs: number | undefined;
  isLoadingMorePast: boolean;
  isLoadingMoreFuture: boolean;
  onFetchMorePast: () => void;
  onFetchMoreFuture: () => void;
  lastPrependedPastCount?: number;
  onPrependedPastCompensated: () => void;
  onHasLiveEdgeChange: (hasLive: boolean) => void;
  onFlowCardClick: (item: CombinedContent) => void;
  currentContentTab: string;
  searchParams: URLSearchParams;
  nip88PollsEnabled: boolean;
  queueTypesFiltered: QueueType[];
  scheduleNext7Days: NonNullable<DashboardIndexLoaderData["scheduleNext7Days"]>;
  targetPerDay: number;
  user: unknown;
  queueCountsByQueue: Array<{ queueName: string; count: number }>;
  onScheduleTargetModalOpen: () => void;
  onCreateQueueClick: () => void;
}

function DashboardReturningUserSplit({
  runwayDays,
  runwaySettings,
  isPostActivationEmpty,
  onRunwayClick,
  splitRegionRef,
  flowZoneHeightPx,
  lowerRowHeightPx,
  desktopFlowCardHeightPx,
  flowError,
  onFlowRetry,
  isNavigatingToDashboard,
  flowItems,
  flowViewRef,
  hasMorePast,
  hasMoreFuture,
  serverNowMs,
  isLoadingMorePast,
  isLoadingMoreFuture,
  onFetchMorePast,
  onFetchMoreFuture,
  lastPrependedPastCount,
  onPrependedPastCompensated,
  onHasLiveEdgeChange,
  onFlowCardClick,
  currentContentTab,
  searchParams,
  nip88PollsEnabled,
  queueTypesFiltered,
  scheduleNext7Days,
  targetPerDay,
  user,
  queueCountsByQueue,
  onScheduleTargetModalOpen,
  onCreateQueueClick,
}: DashboardReturningUserSplitProps) {
  const ignoreFlowScrollInteractionUntilMsRef = useRef(0);
  const [flowAtRest, setFlowAtRest] = useState(true);
  const [suppressFlowNext, setSuppressFlowNext] = useState(false);

  const onFlowRestingScrollChange = useCallback((resting: boolean) => {
    setFlowAtRest(resting);
    if (resting) {
      setSuppressFlowNext(false);
    }
  }, []);

  const onFlowScrollInteraction = useCallback(() => {
    if (Date.now() < ignoreFlowScrollInteractionUntilMsRef.current) {
      return;
    }
    setSuppressFlowNext(false);
  }, []);

  const handleFlowNextClick = useCallback(() => {
    ignoreFlowScrollInteractionUntilMsRef.current = Date.now() + 850;
    setSuppressFlowNext(true);
    flowViewRef.current?.scrollToNext();
  }, [flowViewRef]);

  const showFlowNextButton =
    flowItems.length > 0 && !flowAtRest && !suppressFlowNext;

  return (
    <>
      <div className="max-w-10xl mx-auto w-full flex-shrink-0 space-y-6 px-4 pt-2.5 pb-4 lg:px-8 lg:pt-0">
        <Statistics
          runwayDays={runwayDays}
          onRunwayClick={onRunwayClick}
          runwayRedThresholdDays={runwaySettings?.redThresholdDays}
          runwayOrangeThresholdDays={runwaySettings?.orangeThresholdDays}
          isPostActivationEmpty={isPostActivationEmpty}
        />
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex shrink-0 items-center gap-2.5 lg:gap-3">
            <ContentListPageHeader
              pageType="flow"
              className="min-w-0"
              titleClassName="text-text text-[1.375rem] font-semibold leading-snug tracking-tight lg:text-[1.5rem] lg:font-bold lg:leading-snug"
            />
            {showFlowNextButton ? (
              <button
                type="button"
                onClick={handleFlowNextClick}
                className="focus-ring text-text-secondary hover:text-text hover:bg-surface-hover/45 motion-fast text-body-sm inline-flex items-center gap-0.5 self-center rounded-md px-1.5 py-1 font-medium"
                aria-label="Scroll timeline to next posts or schedule"
              >
                <span>Next</span>
                <ChevronRight
                  className="size-3.5 shrink-0 opacity-90"
                  aria-hidden
                  strokeWidth={2.25}
                />
              </button>
            ) : null}
          </div>
          <div className="flex w-full min-w-0 flex-row flex-wrap items-center gap-2 lg:flex-1 lg:justify-end">
            <PublishingContentTypeFilter
              data-testid="dashboard-type-filter"
              value={currentContentTab}
              ariaLabel="Dashboard content type"
              triggerClassName={DASHBOARD_FLOW_FILTER_TRIGGER_CLASS}
              items={buildDashboardContentTypeFilterItems({
                basePath: "/dashboard",
                searchParams,
                nip88PollsEnabled,
              })}
            />
            <PublishingQueueFilter
              currentTab={currentContentTab}
              queueTypes={queueTypesFiltered}
              basePath="/dashboard"
              triggerClassName={DASHBOARD_FLOW_FILTER_TRIGGER_CLASS}
            />
          </div>
        </div>
      </div>

      <div
        ref={splitRegionRef}
        className="flex w-full min-w-0 flex-col gap-6 lg:min-h-0 lg:flex-1"
      >
        <div
          className={`flow-zone border-border-subtle/75 mt-0 flex min-h-[264px] flex-1 flex-col justify-center overflow-y-auto border-y pt-2 pb-3 md:min-h-[300px] lg:mt-0 lg:shrink-0 lg:justify-center ${
            flowZoneHeightPx != null
              ? "lg:min-h-0 lg:flex-none lg:overflow-visible lg:py-0"
              : "lg:min-h-[300px] lg:flex-none lg:overflow-y-auto lg:pt-2 lg:pb-2.5"
          }`}
          style={
            flowZoneHeightPx != null ? { height: flowZoneHeightPx } : undefined
          }
        >
          {flowError ? (
            <Alert variant="destructive" className="stack-tight mx-4 lg:mx-8">
              <AlertDescription className="stack-tight">
                <span className="font-medium">{flowError.message}</span>
                <button
                  type="button"
                  onClick={onFlowRetry}
                  className="focus-ring bg-brand text-brand-on hover:bg-brand/90 w-fit rounded-md px-3 py-1.5 text-sm font-medium"
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
              <p className="text-text-secondary text-sm">Loading timeline…</p>
            </div>
          ) : (
            <div
              className={`flex min-h-0 min-w-0 flex-col ${
                flowZoneHeightPx != null ? "w-full shrink-0 lg:min-h-0" : ""
              }`}
            >
              <FlowView
                ref={flowViewRef}
                flowItems={flowItems}
                hasMorePast={hasMorePast}
                hasMoreFuture={hasMoreFuture}
                desktopFlowCardHeightPx={desktopFlowCardHeightPx}
                serverNowMs={serverNowMs}
                isLoadingMorePast={isLoadingMorePast}
                isLoadingMoreFuture={isLoadingMoreFuture}
                onCardClick={onFlowCardClick}
                onFetchMorePast={onFetchMorePast}
                onFetchMoreFuture={onFetchMoreFuture}
                lastPrependedPastCount={lastPrependedPastCount}
                onPrependedPastCompensated={onPrependedPastCompensated}
                onHasLiveEdgeChange={onHasLiveEdgeChange}
                isPostActivationEmpty={isPostActivationEmpty}
                onFlowRestingScrollChange={onFlowRestingScrollChange}
                onFlowScrollInteraction={onFlowScrollInteraction}
              />
            </div>
          )}
        </div>

        <div
          className="max-w-10xl mx-auto w-full shrink-0 px-4 max-lg:mt-0 lg:min-h-0 lg:px-8"
          style={
            lowerRowHeightPx != null ? { height: lowerRowHeightPx } : undefined
          }
        >
          <div className="flex min-h-0 min-w-0 flex-col gap-4 max-lg:min-h-0 lg:h-full lg:min-h-0 lg:flex-row lg:items-stretch lg:gap-4">
            <ScheduleNext7DaysCard
              days={scheduleNext7Days}
              targetPerDay={targetPerDay}
              userTimezone={getUserTimezone(user)}
              onOpenTargetModal={onScheduleTargetModalOpen}
              queueTypes={queueTypesFiltered}
              isPostActivationEmpty={isPostActivationEmpty}
            />
            <QueueHealth
              queueCounts={queueCountsByQueue}
              queueTypes={queueTypesFiltered}
              onCreateQueueClick={onCreateQueueClick}
            />
          </div>
        </div>
      </div>
    </>
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
    resetFlowMergeState,
  } = useFlowData();

  const [runwayModalOpen, setRunwayModalOpen] = useState(false);
  const [scheduleOverviewTargetModalOpen, setScheduleOverviewTargetModalOpen] =
    useState(false);
  const [createQueueDialogOpen, setCreateQueueDialogOpen] = useState(false);

  const dashboardRouteData = useRouteLoaderData("routes/dashboard") as
    | { nip88PollsEnabled?: boolean }
    | undefined;
  const nip88PollsEnabled = Boolean(dashboardRouteData?.nip88PollsEnabled);

  const {
    queueCountsByQueue,
    scheduleNext7Days,
    targetPerDay,
    serverNowMs,
    isFirstRunDashboard,
    dashboardActivity,
    isPostActivationEmpty,
  } = useDashboardIndexLoaderDerived();

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
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [postToReschedule, setPostToReschedule] = useState<
    PostData | LongFormPostData | null
  >(null);
  const navigate = useNavigate();

  const _handleReschedulePost = (post: PostData | LongFormPostData) => {
    setPostToReschedule(post);
    setShowRescheduleModal(true);
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
      if (!canAutoRevalidateDashboard()) {
        return;
      }
      revalidator.revalidate();
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revalidator identity can change; we only want one interval per flowItems.length
  }, [flowItems.length]);

  const handleModalSuccess = () => {
    resetFlowMergeState();
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
  const hasAnyQueue = queueTypesFiltered.length > 0;

  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setNowMs(Date.now());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // Runway from server only (no fallback). When mode is "first-queue-empty" and any selected queue is empty, server returns null → show 0 days.
  const runwayDays = useMemo(
    () => computeRunwayDays(lastScheduledAtUtcMs, nowMs),
    [lastScheduledAtUtcMs, nowMs]
  );

  /** For ContentListPageHeader (unused there; runway KPI uses runwayDays). */
  const _flowRunsUntil = useMemo(
    () => computeFlowRunsUntilDate(lastScheduledAtUtcMs, flowItems),
    [lastScheduledAtUtcMs, flowItems]
  );

  const flowViewRef = useRef<FlowViewHandle | null>(null);
  const {
    splitRegionRef,
    flowZoneHeightPx,
    lowerRowHeightPx,
    desktopFlowCardHeightPx,
  } = useDashboardDesktopLayoutHeights(!isFirstRunDashboard);
  const [_hasLiveEdge, setHasLiveEdge] = useState(false);

  useDashboardFlowScrollAfterFilter(
    currentContentTab,
    queueType,
    navigation.state,
    flowViewRef
  );

  const flowPostsForStats = useMemo(
    () => partitionFlowPostsForStats(flowItems),
    [flowItems]
  );

  const { stats: flowStatsMerged } = usePostStatsQuery(
    flowPostsForStats.postDataList,
    { longFormPosts: flowPostsForStats.longFormList }
  );

  const { selectedPostModalStats, selectedLongFormModalStats } =
    useSelectedPublishedFlowModalStats(
      selectedPost,
      selectedLongFormPost,
      flowStatsMerged
    );

  return (
    <>
      <DashboardPlanSuccessMessage
        show={showSuccessMessage}
        message={successMessage}
        onDismiss={() => setShowSuccessMessage(false)}
      />

      {/* Dashboard: top block (Statistics + Your Flow row), scrollable Flow section, bottom block (Queue Health + Top Posts) */}
      <div className="dashboard-canvas flex min-h-0 flex-1 flex-col max-lg:min-h-[calc(100dvh-12rem)] lg:h-full lg:min-h-0">
        {isFirstRunDashboard ? (
          <div className="mt-2.5 lg:mt-0">
            <FirstRunDashboard
              activity={dashboardActivity}
              hasAnyQueue={hasAnyQueue}
            />
          </div>
        ) : (
          <DashboardReturningUserSplit
            runwayDays={runwayDays}
            runwaySettings={runwaySettings}
            isPostActivationEmpty={isPostActivationEmpty}
            onRunwayClick={() => setRunwayModalOpen(true)}
            splitRegionRef={splitRegionRef}
            flowZoneHeightPx={flowZoneHeightPx}
            lowerRowHeightPx={lowerRowHeightPx}
            desktopFlowCardHeightPx={desktopFlowCardHeightPx}
            flowError={flowError}
            onFlowRetry={() => revalidator.revalidate()}
            isNavigatingToDashboard={isNavigatingToDashboard}
            flowItems={flowItems}
            flowViewRef={flowViewRef}
            hasMorePast={hasMorePast}
            hasMoreFuture={hasMoreFuture}
            serverNowMs={serverNowMs}
            isLoadingMorePast={isLoadingMorePast}
            isLoadingMoreFuture={isLoadingMoreFuture}
            onFetchMorePast={fetchMorePast}
            onFetchMoreFuture={fetchMoreFuture}
            lastPrependedPastCount={lastPrependedPastCount}
            onPrependedPastCompensated={clearPrependedPastCount}
            onHasLiveEdgeChange={setHasLiveEdge}
            onFlowCardClick={(item) =>
              handleContentSelection(
                item,
                setSelectedPost,
                setSelectedLongFormPost
              )
            }
            currentContentTab={currentContentTab}
            searchParams={searchParams}
            nip88PollsEnabled={nip88PollsEnabled}
            queueTypesFiltered={queueTypesFiltered}
            scheduleNext7Days={scheduleNext7Days}
            targetPerDay={targetPerDay}
            user={user}
            queueCountsByQueue={queueCountsByQueue}
            onScheduleTargetModalOpen={() =>
              setScheduleOverviewTargetModalOpen(true)
            }
            onCreateQueueClick={() => setCreateQueueDialogOpen(true)}
          />
        )}
      </div>

      <QueueTypeDialog
        open={createQueueDialogOpen}
        onOpenChange={setCreateQueueDialogOpen}
        queueType={null}
        hashTagPresets={hashTagPresets.map((p) => ({
          id: p.id,
          name: p.name,
          tags: p.tags,
          description: p.description ?? undefined,
        }))}
        submitAction="/dashboard/settings"
      />

      <RunwaySettingsModal
        open={runwayModalOpen}
        onOpenChange={setRunwayModalOpen}
        queueTypes={queueTypesFiltered}
        runwaySettings={runwaySettings ?? undefined}
        onSuccess={() => {
          resetFlowMergeState();
          revalidator.revalidate();
        }}
      />

      <ScheduleOverviewTargetModal
        key={
          scheduleOverviewTargetModalOpen ? `open-${targetPerDay}` : "closed"
        }
        open={scheduleOverviewTargetModalOpen}
        onClose={() => setScheduleOverviewTargetModalOpen(false)}
        targetPerDay={targetPerDay}
        onSuccess={() => {
          resetFlowMergeState();
          revalidator.revalidate();
        }}
      />

      {selectedPost ? (
        <PostDetailsModal
          post={selectedPost}
          stats={selectedPostModalStats}
          onClose={() => setSelectedPost(null)}
          onDeleted={() => {
            resetFlowMergeState();
            revalidator.revalidate();
          }}
          onEdit={(p) => {
            setSelectedPost(null);
            navigate(
              buildComposeEditUrl({
                mode: "edit_scheduled",
                scheduledActionId: String(p.id),
              })
            );
          }}
          onReschedule={(p) => {
            setSelectedPost(null);
            _handleReschedulePost(p as PostData);
          }}
          showStats={getFlowItemModalType(selectedPost) === "published"}
          showSignedEvent={true}
          type={getFlowItemModalType(selectedPost)}
          userTimezone={getUserTimezone(user)}
          userTimeFormat={userTimeFormat}
        />
      ) : null}

      {selectedLongFormPost ? (
        <LongFormDetailsModal
          post={selectedLongFormPost}
          stats={selectedLongFormModalStats}
          onClose={() => setSelectedLongFormPost(null)}
          onDeleted={() => {
            resetFlowMergeState();
            revalidator.revalidate();
          }}
          onEdit={(p) => {
            setSelectedLongFormPost(null);
            navigate(
              `/dashboard/compose?type=article&scheduled=${encodeURIComponent(String(p.id))}`
            );
          }}
          onReschedule={(p) => {
            setSelectedLongFormPost(null);
            _handleReschedulePost(p as LongFormPostData);
          }}
          type={getFlowItemModalType(selectedLongFormPost)}
          showStats={getFlowItemModalType(selectedLongFormPost) === "published"}
          showSignedEvent={true}
          userTimezone={getUserTimezone(user)}
          userTimeFormat={userTimeFormat}
        />
      ) : null}

      {showRescheduleModal && postToReschedule ? (
        <RescheduleScheduledPostModal
          post={postToReschedule}
          onClose={handleCloseRescheduleModal}
          onSuccess={() => {
            handleCloseRescheduleModal();
            handleModalSuccess();
          }}
          user={user ? (validateUserData(user) ?? undefined) : undefined}
          queueTypes={queueTypesFiltered}
          userTimeFormat={userTimeFormat}
        />
      ) : null}
    </>
  );
}
