import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  handleScheduledAction,
  loadScheduledData,
  type LongFormPostType as _LongFormPostType,
  type UserData as _UserData,
} from "~/features/posts/server";
import { ScheduledPostsPage } from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { scheduledPostsLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to scheduled posts feature
    await requireFeatureAccess(userId, "scheduled");

    const url = new URL(request.url);
    const queueType =
      params["queueType"] ?? url.searchParams.get("queueType") ?? "all";
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const limit = 20;
    const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
    const dateTo = url.searchParams.get("dateTo") ?? undefined;

    const data = await loadScheduledData(
      userId,
      queueType,
      page,
      limit,
      dateFrom,
      dateTo
    );

    // Validate loader response with Zod schema
    return validateLoaderResponse(data, scheduledPostsLoaderDataSchema);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const formData = await request.formData();
      const result = await handleScheduledAction(formData, userId);

      // Type narrowing: check if result is a Response
      if (result instanceof Response) {
        return result;
      }

      // Type narrowing: check if result has error property
      if (
        typeof result === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety: result may be null
        result &&
        "error" in result &&
        result.error
      ) {
        return json(result, { status: 400 });
      }

      return json(result);
    } catch (error) {
      // If error is a Response (e.g., redirect from requireUserId), return it
      if (error instanceof Response) {
        return error;
      }
      // Use dynamic import to avoid bundling issues
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

type _LoaderData = Awaited<ReturnType<typeof loader>>;

export default ScheduledPostsPage;
