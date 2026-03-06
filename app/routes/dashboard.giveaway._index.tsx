import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { GiveawayPage } from "~/features/giveaway";
import { listGiveawaysByUser } from "~/features/giveaway/giveaway-actions.server";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";

/** List page loader: only giveaways list (no posts/stats/relatedEvents). */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    await requireAnySubscription(userId);
    await requireFeatureAccess(userId, "giveaways");

    const giveaways = await listGiveawaysByUser(userId);

    return {
      giveaways: giveaways.map((g) => ({
        id: g.id,
        status: g.status,
        scopeType: g.scopeType,
        winnerCount: g.winnerCount,
        createdAt: g.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}

type _LoaderData = Exclude<Awaited<ReturnType<typeof loader>>, Response>;

export default GiveawayPage;
