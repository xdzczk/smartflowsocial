import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { requireFeatureAccess } from "~/features/payments";
import {
  handleDashboardAction,
  loadDashboardData,
  type LongFormPostType as _LongFormPostType,
  type UserData as _UserData,
} from "~/features/posts/server";
import { DashboardIndexPage } from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { dashboardLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  try {
    const userId = await requireUserId(request);

    // Check if user has access to the dashboard feature
    await requireFeatureAccess(userId, "dashboard");

    // Check for success message in URL params
    const url = new URL(request.url);
    const planActivated = url.searchParams.get("planActivated");
    const successMessage = url.searchParams.get("message");

    // Get queueType from URL params (query string) or route params, default to "all"
    const queueType =
      url.searchParams.get("queueType") ?? params["queueType"] ?? "all";
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const limit = 20;

    const data = await loadDashboardData(userId, queueType, page, limit);

    // Add URL params to data before validation
    const dataWithParams = {
      ...data,
      planActivated,
      successMessage,
    };

    // Validate loader response with Zod schema
    const validatedData = validateLoaderResponse(
      dataWithParams,
      dashboardLoaderDataSchema
    );

    return json(validatedData);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {
      scheduledPosts: [],
      longformPosts: [],
      user: null,
      queueTypes: [],
      hashTagPresets: [],
      postStatistics: undefined,
      selectedQueueType: "all",
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
