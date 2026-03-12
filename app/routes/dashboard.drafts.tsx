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
import { DraftsPage } from "~/features/posts/drafts";
import type { LongFormPostType as _LongFormPostType } from "~/features/posts/server";
import {
  handleDraftsAction,
  loadDraftsData,
} from "~/features/posts/server/drafts";
import { withCSRFProtection } from "~/lib/csrf";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { draftsLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to the drafts feature
    await requireFeatureAccess(userId, "drafts");

    // Get queueType from URL params (query string) or route params, default to "all"
    const url = new URL(request.url);
    const queueType =
      url.searchParams.get("queueType") ?? params["queueType"] ?? "all";
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const limit = 20;

    const data = await loadDraftsData(userId, queueType, page, limit);

    // Validate loader response with Zod schema
    return validateLoaderResponse(data, draftsLoaderDataSchema);
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
      const result = await handleDraftsAction(formData, userId);

      // Type narrowing: check if result is a Response
      if (result instanceof Response) {
        return result;
      }

      // Type narrowing: check if result has error property

      if (typeof result === "object" && "error" in result && result.error) {
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

export default DraftsPage;
