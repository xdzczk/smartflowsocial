import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  handleCalendarAction,
  loadCalendarQueueData,
  type UserData as _UserData,
  type QueueType as _QueueType,
} from "~/features/posts/server";
import { CalendarQueuePage } from "~/features/posts/ui";
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
      const userId = await requireUserId(request);
      const formData = await request.formData();
      return handleCalendarAction(formData, userId);
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
