import { defer, json, type LoaderFunctionArgs } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import { PublishedPostsPage } from "~/features/posts/publishing";
import { PublishedPostsPageSkeleton } from "~/features/posts/publishing/PublishedPostsPageSkeleton";
import type { LongFormPostType as _LongFormPostType } from "~/features/posts/server";
import { getPublishedDashboardData } from "~/features/posts/server/publishing";
import { DeferredRouteLoaderProvider } from "~/lib/remix/deferred-route-loader-context";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import {
  publishedPostsLoaderDataSchema,
  type PublishedPostsLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

export { publishedPostsAction as action } from "~/features/posts/published.action.server";

async function loadPublishedData(
  request: Request,
  params: { queueType?: string }
): Promise<PublishedPostsLoaderData> {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  const url = new URL(request.url);
  const data = await getPublishedDashboardData({ userId, params, url });
  return validateLoaderResponse(data, publishedPostsLoaderDataSchema);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const p = params as { queueType?: string };
    if (isRemixResourceRequest(request)) {
      return json(await loadPublishedData(request, p));
    }
    return defer({
      published: loadPublishedData(request, p),
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}

export function shouldRevalidate(args: {
  currentUrl: URL;
  nextUrl: URL;
  formAction?: string;
  defaultShouldRevalidate: boolean;
}) {
  const isPublishedAction =
    typeof args.formAction === "string" &&
    args.formAction.includes("/dashboard/published");

  if (isPublishedAction) {
    return true;
  }

  if (
    args.currentUrl.pathname === args.nextUrl.pathname &&
    args.currentUrl.search === args.nextUrl.search
  ) {
    return false;
  }

  return args.defaultShouldRevalidate;
}

interface PublishedDeferredLoaderData {
  published: Promise<PublishedPostsLoaderData>;
}

function PublishedFeedRoute() {
  const { published } = useLoaderData() as PublishedDeferredLoaderData;

  return (
    <Suspense fallback={<PublishedPostsPageSkeleton />}>
      <Await
        resolve={published}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/published" />
        }
      >
        {(data) => (
          <DeferredRouteLoaderProvider value={data}>
            <PublishedPostsPage />
          </DeferredRouteLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}

export default PublishedFeedRoute;
