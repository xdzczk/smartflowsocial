import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { GiveawayQueuePage, loadGiveawayData } from "~/features/giveaway";
import { requireAnySubscription } from "~/features/payments";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { giveawayLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);
    // Check if user has access to giveaway feature
    await requireAnySubscription(userId);

    const url = new URL(request.url);
    const queueType = params["queueType"] ?? "all";
    const days = parseInt(url.searchParams.get("days") ?? "7");

    const data = await loadGiveawayData(userId, queueType, days);

    // Validate loader response with Zod schema
    return validateLoaderResponse(data, giveawayLoaderDataSchema);
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

export default GiveawayQueuePage;
