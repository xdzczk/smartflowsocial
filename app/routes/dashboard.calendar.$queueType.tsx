import {
  defer,
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { requireSession, requireUserId } from "~/features/auth";
import { CalendarQueuePage } from "~/features/posts/calendar";
import { CalendarQueuePageSkeleton } from "~/features/posts/calendar/CalendarQueuePageSkeleton";
import type {
  UserData as _UserData,
  QueueType as _QueueType,
} from "~/features/posts/server";
import {
  handleCalendarAction,
  loadCalendarQueueData,
} from "~/features/posts/server/calendar";
import { withCSRFProtection } from "~/lib/csrf";
import { DeferredRouteLoaderProvider } from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import {
  calendarQueueLoaderDataSchema,
  type CalendarQueueLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

async function loadCalendarQueueValidated(
  request: Request,
  params: LoaderFunctionArgs["params"]
): Promise<CalendarQueueLoaderData> {
  const userId = await requireUserId(request);
  const queueType = params["queueType"] ?? "all";
  const data = await loadCalendarQueueData(userId, queueType);
  return validateLoaderResponse(data, calendarQueueLoaderDataSchema);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    if (isRemixResourceRequest(request)) {
      return json(await loadCalendarQueueValidated(request, params));
    }
    return defer({
      calendarQueue: loadCalendarQueueValidated(request, params),
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
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
      if (error instanceof Response) {
        return error;
      }
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

interface CalendarQueueDeferredLoaderData {
  calendarQueue: Promise<CalendarQueueLoaderData>;
}

function CalendarQueueFeedRoute() {
  const { calendarQueue } = useLoaderData() as CalendarQueueDeferredLoaderData;

  return (
    <Suspense fallback={<CalendarQueuePageSkeleton />}>
      <Await
        resolve={calendarQueue}
        errorElement={<DeferredRouteAwaitError retryTo="/dashboard/calendar" />}
      >
        {(data) => (
          <DeferredRouteLoaderProvider value={data}>
            <CalendarQueuePage />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}

export default CalendarQueueFeedRoute;
