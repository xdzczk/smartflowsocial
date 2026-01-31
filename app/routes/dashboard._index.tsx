import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { requireFeatureAccess } from "~/features/payments";
import {
  getContentStatistics,
  handleDashboardAction,
  loadFlowData,
} from "~/features/posts/server";
import { DashboardIndexPage } from "~/features/posts/ui";
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
  postStatistics: EMPTY_STATS,
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

    const [data, postStatistics] = await Promise.all([
      loadFlowData({
        userId,
        queueType,
        pastLimit: 20,
        futureLimit: 30,
        before,
        after,
      }),
      getContentStatistics(userId),
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
      });
    }

    return json({
      ...validatedData,
      postStatistics,
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
export default DashboardIndexPage;
