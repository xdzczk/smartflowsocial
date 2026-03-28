import {
  defer,
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { DeferredListPageSkeleton } from "~/components/skeletons/DeferredListPageSkeleton";
import { requireUserId } from "~/features/auth";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import { SCHEDULED_DATE_RANGE_QUERY_LIMIT } from "~/features/posts/deferred-loader-limits";
import { ScheduledPostsPage } from "~/features/posts/scheduling";
import type {
  LongFormPostType as _LongFormPostType,
  UserData as _UserData,
} from "~/features/posts/server";
import {
  handleScheduledAction,
  loadScheduledData,
} from "~/features/posts/server/scheduling";
import { withCSRFProtection } from "~/lib/csrf";
import { DeferredRouteLoaderProvider } from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import {
  scheduledPostsLoaderDataSchema,
  type ScheduledPostsLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

async function loadScheduledValidated(
  request: Request,
  params: LoaderFunctionArgs["params"]
): Promise<ScheduledPostsLoaderData> {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "scheduled");

  const url = new URL(request.url);
  const queueType =
    params["queueType"] ?? url.searchParams.get("queueType") ?? "all";
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;
  const hasDateRange = Boolean(dateFrom ?? dateTo);
  const page = hasDateRange
    ? 1
    : parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = hasDateRange ? SCHEDULED_DATE_RANGE_QUERY_LIMIT : 20;

  const data = await loadScheduledData(
    userId,
    queueType,
    page,
    limit,
    dateFrom,
    dateTo
  );

  const outData = hasDateRange
    ? {
        ...data,
        pagination: { ...data.pagination, pages: 1 },
        longformPagination: { ...data.longformPagination, pages: 1 },
      }
    : data;

  return validateLoaderResponse(outData, scheduledPostsLoaderDataSchema);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    if (isRemixResourceRequest(request)) {
      return json(await loadScheduledValidated(request, params));
    }
    return defer({
      scheduled: loadScheduledValidated(request, params),
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
      const userId = await requireUserId(request);
      const formData = await request.formData();
      const result = await handleScheduledAction(formData, userId);

      if (result instanceof Response) {
        return result;
      }

      return json(result);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

interface ScheduledDeferredLoaderData {
  scheduled: Promise<ScheduledPostsLoaderData>;
}

function ScheduledFeedRoute() {
  const { scheduled } = useLoaderData() as ScheduledDeferredLoaderData;

  return (
    <Suspense
      fallback={
        <DeferredListPageSkeleton
          title="Scheduled"
          subtitle="Upcoming publishes and time slots"
        />
      }
    >
      <Await
        resolve={scheduled}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/scheduled" />
        }
      >
        {(data) => (
          <DeferredRouteLoaderProvider value={data}>
            <ScheduledPostsPage />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}

export default ScheduledFeedRoute;
