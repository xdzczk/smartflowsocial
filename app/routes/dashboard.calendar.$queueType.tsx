import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

import { requireSession, requireUserId } from "~/features/auth";
import { CalendarQueuePage } from "~/features/posts/calendar";
import type {
  UserData as _UserData,
  QueueType as _QueueType,
} from "~/features/posts/server";
import {
  handleCalendarAction,
  loadCalendarQueueData,
} from "~/features/posts/server/calendar";
import { withCSRFProtection } from "~/lib/csrf";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { calendarQueueLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const queueType = params["queueType"] ?? "all";

    const data = await loadCalendarQueueData(userId, queueType);

    // Validate loader response with Zod schema
    return validateLoaderResponse(data, calendarQueueLoaderDataSchema);
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

export default CalendarQueuePage;
