import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useLocation, useNavigation } from "@remix-run/react";

import { DashboardSkeleton } from "~/components/skeletons/DashboardSkeleton";
import { requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import {
  getContentStatistics,
  getQueueCountsForDashboard,
  getRunwayLastScheduledAtUtcMs,
  getScheduleNext7DaysCounts,
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
  scheduleNext7Days: [] as Array<{
    dateKey: string;
    count: number;
    byQueue?: Array<{ queueName: string; count: number }>;
  }>,
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const userId = await requireUserId(request);

    // Allow any logged-in user with a subscription record (including free/expired); no redirect to /plans
    await requireAnySubscription(userId);

    const url = new URL(request.url);
    const queueType =
      url.searchParams.get("queueType") ?? params["queueType"] ?? "all";
    const contentTab =
      (url.searchParams.get("tab") as
        | "all"
        | "posts"
        | "longform"
        | "reposts"
        | "polls"
        | null) ?? "all";
    const before = url.searchParams.get("before") ?? undefined;
    const after = url.searchParams.get("after") ?? undefined;

    // Initial load: fetch only ~5–8 visible cards + buffer for fast TTI; load-more fills the rest
    const initialPastLimit = before !== undefined ? 20 : 6;
    const initialFutureLimit = after !== undefined ? 30 : 10;
    const [data, postStatistics, queueCountsByQueue] = await Promise.all([
      loadFlowData({
        userId,
        queueType,
        contentTab: contentTab === "all" ? undefined : contentTab,
        pastLimit: initialPastLimit,
        futureLimit: initialFutureLimit,
        before,
        after,
      }),
      getContentStatistics(userId),
      getQueueCountsForDashboard(userId),
    ]);

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
        scheduleNext7Days: [],
      });
    }

    const now = new Date();
    const userTimezone = validatedData.user?.timezone ?? "Etc/UTC";
    const runwaySettings = await getRunwaySettings(userId);
    const [runwayLastScheduledAtUtc, scheduleNext7Days] = await Promise.all([
      getRunwayLastScheduledAtUtcMs(userId, now, runwaySettings),
      getScheduleNext7DaysCounts(userId, "all", userTimezone),
    ]);

    return json({
      ...validatedData,
      runwayLastScheduledAtUtc,
      runwaySettings,
      postStatistics,
      queueCountsByQueue,
      scheduleNext7Days,
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
      scheduleNext7Days: [],
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
