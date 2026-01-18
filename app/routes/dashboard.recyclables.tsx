import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  getRecyclableDashboardData,
  handleRecyclablePostAction,
} from "~/features/posts/server";
import { RecyclablesPage } from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { recyclablesLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to recyclables feature
    await requireFeatureAccess(userId, "recyclables");

    const url = new URL(request.url);

    const data = await getRecyclableDashboardData({ userId, params, url });

    // Validate loader response with Zod schema
    return validateLoaderResponse(data, recyclablesLoaderDataSchema);
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

      return handleRecyclablePostAction(formData, userId);
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

export default RecyclablesPage;
