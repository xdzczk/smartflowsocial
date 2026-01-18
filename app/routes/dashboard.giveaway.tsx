import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { GiveawayPage, loadGiveawayData } from "~/features/giveaway";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to giveaway feature
    await requireFeatureAccess(userId, "giveaways");

    const url = new URL(request.url);
    const queueType = params["queueType"] ?? "all";
    const days = parseInt(url.searchParams.get("days") ?? "7");

    return await loadGiveawayData(userId, queueType, days);
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

type _LoaderData = Exclude<Awaited<ReturnType<typeof loader>>, Response>;

export default GiveawayPage;
