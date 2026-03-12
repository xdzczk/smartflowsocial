import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

import { requireSession, requireUserId } from "~/features/auth";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { CalendarPage } from "~/features/posts/calendar";
import {
  handleCalendarAction,
  loadCalendarData,
} from "~/features/posts/server/calendar";
import { withCSRFProtection } from "~/lib/csrf";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { calendarLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to calendar feature
    await requireFeatureAccess(userId, "calendar");

    const url = new URL(request.url);
    const queueType =
      params["queueType"] ?? url.searchParams.get("queueType") ?? "all";

    const data = await loadCalendarData(userId, queueType);

    // Validate loader response with Zod schema
    return validateLoaderResponse(data, calendarLoaderDataSchema);
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
      const { userId, pubkey } = await requireSession(request);
      const formData = await request.formData();
      return handleCalendarAction(formData, userId, pubkey);
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

type _LoaderData = Exclude<Awaited<ReturnType<typeof loader>>, Response>;

export default CalendarPage;
