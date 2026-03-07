import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { GiveawayPage } from "~/features/giveaway";
import { listGiveawaysByUser } from "~/features/giveaway/giveaway-actions.server";
import {
  formatScopeSummaryLabel,
  formatStatusLabel,
  getQueueNamesByIds,
} from "~/features/giveaway/giveaway-display.server";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";

/** List page loader: giveaways list with humanized scope and status. */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);

    await requireAnySubscription(userId);
    await requireFeatureAccess(userId, "giveaways");

    const giveaways = await listGiveawaysByUser(userId);
    const queueIds = giveaways
      .map((g) => (g.scopeReference as Record<string, unknown>)["queueId"])
      .filter((id): id is string => typeof id === "string");
    const uniqueQueueIds = [...new Set(queueIds)];
    const queueNameById = await getQueueNamesByIds(userId, uniqueQueueIds);

    return {
      giveaways: giveaways.map((g) => {
        const ref = g.scopeReference as Record<string, unknown>;
        const queueId =
          typeof ref["queueId"] === "string" ? ref["queueId"] : null;
        const queueName = queueId ? (queueNameById[queueId] ?? null) : null;
        return {
          id: g.id,
          name: g.name ?? null,
          status: g.status,
          statusLabel: formatStatusLabel(g.status),
          scopeSummaryLabel: formatScopeSummaryLabel(
            g.scopeType,
            ref,
            queueName
          ),
          winnerCount: g.winnerCount,
          createdAt: g.createdAt.toISOString(),
        };
      }),
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
