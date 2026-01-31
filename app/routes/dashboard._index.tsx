import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { requireFeatureAccess } from "~/features/payments";
import { handleDashboardAction, loadFlowData } from "~/features/posts/server";
import { DashboardIndexPage } from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { flowLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";

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

    const data = await loadFlowData({
      userId,
      queueType,
      pastLimit: 20,
      futureLimit: 30,
      before,
      after,
    });

    // Validate loader response with Zod schema
    const validatedData = validateLoaderResponse(data, flowLoaderDataSchema);

    return json(validatedData);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {
      flowItems: [],
      hasMorePast: false,
      hasMoreFuture: false,
      pastCursor: null,
      futureCursor: null,
      user: null,
      queueTypes: [],
      hashTagPresets: [],
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
