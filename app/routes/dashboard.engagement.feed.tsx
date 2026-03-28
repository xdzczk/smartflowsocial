import { defer, json, type LoaderFunctionArgs } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { requireUserId } from "~/features/auth";
import {
  ENGAGEMENT_FEED_PAGE_SIZE,
  ENGAGEMENT_LOADER_FALLBACK,
  EngagementFeedAwaitError,
  EngagementFeedPage,
  EngagementFeedSkeleton,
  EngagementResolvedLoaderProvider,
  loadEngagementFeedData,
} from "~/features/engagement";
import { requireAnySubscription } from "~/features/payments";
import { logError } from "~/lib/error-logger.server";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import {
  engagementLoaderDataSchema,
  type EngagementLoaderData,
} from "~/lib/validation/schemas/loader-responses.schemas";

async function loadEngagementValidatedOrThrow(
  userId: string,
  page: number,
  limit: number
): Promise<EngagementLoaderData> {
  const data = await loadEngagementFeedData(userId, page, limit);
  return validateLoaderResponse(data, engagementLoaderDataSchema);
}

async function loaderImpl({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = ENGAGEMENT_FEED_PAGE_SIZE;
  const isDataRequest = url.searchParams.has("_data");

  if (isDataRequest) {
    try {
      return json(await loadEngagementValidatedOrThrow(userId, page, limit));
    } catch (error) {
      const { handleLoaderError } = await import("~/lib/error-handler.server");
      return handleLoaderError(error, ENGAGEMENT_LOADER_FALLBACK);
    }
  }

  const engagementPromise = (async (): Promise<EngagementLoaderData> => {
    try {
      return await loadEngagementValidatedOrThrow(userId, page, limit);
    } catch (error: unknown) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        message:
          "Engagement feed deferred load failed; returning empty fallback",
        userId,
      });
      return ENGAGEMENT_LOADER_FALLBACK;
    }
  })();

  return defer({
    engagement: engagementPromise,
  });
}

export const loader = async (args: LoaderFunctionArgs) => {
  try {
    return await loaderImpl(args);
  } catch (error) {
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, ENGAGEMENT_LOADER_FALLBACK);
  }
};

interface EngagementFeedDeferredLoaderData {
  engagement: Promise<EngagementLoaderData>;
}

export default function EngagementFeedRoute() {
  const { engagement } = useLoaderData<EngagementFeedDeferredLoaderData>();

  return (
    <Suspense fallback={<EngagementFeedSkeleton />}>
      <Await resolve={engagement} errorElement={<EngagementFeedAwaitError />}>
        {(data) => (
          <EngagementResolvedLoaderProvider
            value={data as EngagementLoaderData}
          >
            <EngagementFeedPage />
          </EngagementResolvedLoaderProvider>
        )}
      </Await>
    </Suspense>
  );
}
