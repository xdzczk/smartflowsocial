import {
  defer,
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { RecyclablesPageSkeleton } from "~/components/skeletons/RoutePageSkeletons";
import { requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import { RecyclablesPage } from "~/features/posts/publishing";
import {
  getRecyclableDashboardData,
  handleRecyclablePostAction,
} from "~/features/posts/server/publishing";
import { withCSRFProtection } from "~/lib/csrf";
import { DeferredRouteLoaderProvider } from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import {
  recyclablesLoaderDataSchema,
  type RecyclablesLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

async function loadRecyclablesValidated(
  request: Request,
  params: LoaderFunctionArgs["params"]
): Promise<RecyclablesLoaderData> {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const data = await getRecyclableDashboardData({ userId, params, url });
  return validateLoaderResponse(data, recyclablesLoaderDataSchema);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    if (isRemixResourceRequest(request)) {
      return json(await loadRecyclablesValidated(request, params));
    }
    return defer({
      recyclables: loadRecyclablesValidated(request, params),
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
      return await handleRecyclablePostAction(formData, userId);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

interface RecyclablesDeferredLoaderData {
  recyclables: Promise<RecyclablesLoaderData>;
}

function RecyclablesFeedRoute() {
  const { recyclables } = useLoaderData() as RecyclablesDeferredLoaderData;

  return (
    <Suspense fallback={<RecyclablesPageSkeleton />}>
      <Await
        resolve={recyclables}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/recyclables" />
        }
      >
        {(data) => (
          <DeferredRouteLoaderProvider value={data}>
            <RecyclablesPage />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}

export default RecyclablesFeedRoute;
