import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useLocation, useNavigation } from "@remix-run/react";

import { DashboardSkeleton } from "~/components/skeletons/DashboardSkeleton";
import { requireUserId } from "~/features/auth";
import { requireFeatureAccess } from "~/features/payments";
import {
  getContentStatistics,
  getQueueCountsForDashboard,
  getTopPostedPostsByEngagement,
  getRunwayLastScheduledAtUtcMs,
  handleDashboardAction,
  loadFlowData,
} from "~/features/posts/server";
import { DashboardIndexPage } from "~/features/posts/ui";
import { getRunwaySettings } from "~/features/user";
import { withCSRFProtection } from "~/lib/csrf";
import { logWarning } from "~/lib/error-logger.server";
import { ValidationError } from "~/lib/errors";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { flowLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";

const EMPTY_STATS = { scheduledCount: 0, successCount: 0 };

const FALLBACK_FLOW = {
  flowItems: [],
  hasMorePast: false,
  hasMoreFuture: false,
  pastCursor: null,
  futureCursor: null,
  user: null,
  queueTypes: [],
  hashTagPresets: [],
  runwayLastScheduledAtUtc: null as number | null,
  runwaySettings: undefined as
    | { queueNames: string[]; mode: "last-post" | "first-queue-empty" }
    | undefined,
  postStatistics: EMPTY_STATS,
  queueCountsByQueue: [] as Array<{ queueName: string; count: number }>,
  topPosts: [] as Array<{ post: unknown; stats: unknown }>,
  topPostsTimeframe: 7,
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const userId = await requireUserId(request);

    // Check if user has access to the dashboard feature
    await requireFeatureAccess(userId, "dashboard");

    const url = new URL(request.url);
    const queueType =
      url.searchParams.get("queueType") ?? params["queueType"] ?? "all";
    const before = url.searchParams.get("before") ?? undefined;
    const after = url.searchParams.get("after") ?? undefined;
    const topPostsDaysParam = url.searchParams.get("topPostsDays");
    const topPostsDays =
      topPostsDaysParam === "30" ? 30 : topPostsDaysParam === "7" ? 7 : 7;

    // Initial load: fetch only ~5–8 visible cards + buffer for fast TTI; load-more fills the rest
    const initialPastLimit = before !== undefined ? 20 : 6;
    const initialFutureLimit = after !== undefined ? 30 : 10;
    const [data, postStatistics, queueCountsByQueue, topPostsResult] =
      await Promise.all([
        loadFlowData({
          userId,
          queueType,
          pastLimit: initialPastLimit,
          futureLimit: initialFutureLimit,
          before,
          after,
        }),
        getContentStatistics(userId),
        getQueueCountsForDashboard(userId),
        getTopPostedPostsByEngagement({
          userId,
          days: topPostsDays,
          limit: 5,
        }),
      ]);
    const { topPosts, timeframeDays: topPostsTimeframe } = topPostsResult;

    // Validate loader response with Zod schema
    let validatedData;
    try {
      validatedData = validateLoaderResponse(data, flowLoaderDataSchema);
    } catch (validationErr) {
      // Always return 200 with fallback so the page loads; 400 would break the document request
      logWarning("Dashboard flow loader validation failed", {
        message:
          validationErr instanceof Error ? validationErr.message : "Unknown",
        context:
          validationErr instanceof ValidationError
            ? validationErr.context
            : undefined,
      });
      return json({
        ...FALLBACK_FLOW,
        postStatistics,
        queueCountsByQueue,
        topPosts,
        topPostsTimeframe,
      });
    }

    const now = new Date();
    const runwaySettings = await getRunwaySettings(userId);
    const runwayLastScheduledAtUtc = await getRunwayLastScheduledAtUtcMs(
      userId,
      now,
      runwaySettings
    );

    return json({
      ...validatedData,
      runwayLastScheduledAtUtc,
      runwaySettings,
      postStatistics,
      queueCountsByQueue,
      topPosts,
      topPostsTimeframe,
    });
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {
      ...FALLBACK_FLOW,
      runwayLastScheduledAtUtc: null,
      runwaySettings: undefined,
      postStatistics: EMPTY_STATS,
      queueCountsByQueue: [],
      topPosts: [],
      topPostsTimeframe: 7,
    });
  }
};

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const formData = await request.formData();
      const result = await handleDashboardAction(formData, userId);

      // Check if result is a Response (redirect/error response)
      if (result instanceof Response) {
        return result;
      }

      // Check if result has error property
      if (typeof result === "object" && "error" in result && result.error) {
        return json(result, { status: 400 });
      }

      return json(result);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);
function DashboardIndexRoute() {
  const location = useLocation();
  const navigation = useNavigation();
  const isNavigatingFromAnotherRoute =
    navigation.state === "loading" &&
    navigation.location.pathname.split("?")[0] === "/dashboard" &&
    location.pathname !== "/dashboard";

  if (isNavigatingFromAnotherRoute) {
    return <DashboardSkeleton />;
  }
  return <DashboardIndexPage />;
}

export default DashboardIndexRoute;
