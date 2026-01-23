import { json, type LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  EngagementFeedPage,
  loadEngagementFeedData,
} from "~/features/engagement";
import { requireAnySubscription } from "~/features/payments";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { engagementLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
async function loaderImpl({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = 20; // Get last 20 posts

  const data = await loadEngagementFeedData(userId, page, limit);

  // Validate loader response with Zod schema
  return json(validateLoaderResponse(data, engagementLoaderDataSchema));
}

export const loader = async (args: LoaderFunctionArgs) => {
  try {
    return await loaderImpl(args);
  } catch (error) {
    // Return safe default data on error using centralized error handling
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {
      posts: [],
      stats: {},
      user: {},
      notifications: {
        all: [],
        replies: [],
        mentions: [],
        zaps: [],
        quotes: [],
      },
      groupedNotifications: {
        replies: [],
        quotes: [],
      },
      trustScores: {},
    });
  }
};

type _LoaderData = Awaited<ReturnType<typeof loaderImpl>>;

export default EngagementFeedPage;
