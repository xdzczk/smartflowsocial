import {
  defer,
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { CalendarPageSkeleton } from "~/components/skeletons/RoutePageSkeletons";
import { requireSession, requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import { CalendarPage } from "~/features/posts/calendar";
import {
  handleCalendarAction,
  loadCalendarData,
} from "~/features/posts/server/calendar";
import { withCSRFProtection } from "~/lib/csrf";
import { DeferredRouteLoaderProvider } from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import {
  calendarLoaderDataSchema,
  type CalendarLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

async function loadCalendarValidated(
  request: Request,
  params: LoaderFunctionArgs["params"]
): Promise<CalendarLoaderData> {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const queueType =
    params["queueType"] ?? url.searchParams.get("queueType") ?? "all";

  const data = await loadCalendarData(userId, queueType);
  return validateLoaderResponse(data, calendarLoaderDataSchema);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    if (isRemixResourceRequest(request)) {
      return json(await loadCalendarValidated(request, params));
    }
    return defer({
      calendar: loadCalendarValidated(request, params),
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

interface CalendarDeferredLoaderData {
  calendar: Promise<CalendarLoaderData>;
}

function CalendarFeedRoute() {
  const { calendar } = useLoaderData() as CalendarDeferredLoaderData;

  return (
    <Suspense fallback={<CalendarPageSkeleton />}>
      <Await
        resolve={calendar}
        errorElement={<DeferredRouteAwaitError retryTo="/dashboard/calendar" />}
      >
        {(data) => (
          <DeferredRouteLoaderProvider value={data}>
            <CalendarPage />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}

export default CalendarFeedRoute;
