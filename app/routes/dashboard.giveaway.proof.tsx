import type { LoaderFunctionArgs } from "@remix-run/node";
import { defer, json } from "@remix-run/node";
import { Await, Link, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import { DeferredRouteAwaitError } from "~/components/deferred-route/DeferredRouteAwaitError";
import { requireUserId } from "~/features/auth";
import type { GiveawayWinnerEntry } from "~/features/giveaway";
import { GiveawayProofPageSkeleton } from "~/features/giveaway";
import { listGiveawaysByUser } from "~/features/giveaway/giveaway-actions.server";
import {
  formatScopeSummaryLabel,
  formatStatusLabel,
  resolveGiveawayQueueName,
} from "~/features/giveaway/giveaway-display.server";
import {
  budgetSatsFromGiveawayRow,
  normalizePayoutState,
  totalSatsPaidFromState,
} from "~/features/giveaway/giveaway-payout.server";
import { requireAnySubscription } from "~/features/payments";
import { GiveawayProofStudio } from "~/features/proof/giveaway/GiveawayProofStudio";
import type { GiveawayProofStudioDto } from "~/lib/proof/adapters/giveaway";
import { isRemixResourceRequest } from "~/lib/remix/is-remix-resource-request";

function giveawayProofTitle(
  name: string | null | undefined,
  id: string
): string {
  const trimmed = name?.trim();
  if (trimmed === undefined || trimmed === "") {
    return `Giveaway ${id.slice(0, 8)}`;
  }
  return trimmed;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const giveawaysPromise = (async (): Promise<GiveawayProofStudioDto[]> => {
    const paid = await listGiveawaysByUser(userId, { status: "PAID_OUT" });
    return Promise.all(
      paid.map(async (g) => {
        const ref = g.scopeReference as Record<string, unknown>;
        const hasQueue =
          g.scopeType === "QUEUE" ||
          (typeof ref["queueId"] === "string" && ref["queueId"].trim() !== "");
        const queueName = hasQueue
          ? await resolveGiveawayQueueName(userId, ref)
          : null;
        const scopeSummaryLabel = formatScopeSummaryLabel(
          g.scopeType,
          ref,
          queueName
        );
        const snapshot =
          (g.winnerSnapshot as GiveawayWinnerEntry[] | null) ?? [];
        const winnerCount =
          snapshot.length > 0 ? snapshot.length : g.winnerCount;
        const payoutState = normalizePayoutState(g.payoutState, snapshot);
        let paidViaWalletCount = 0;
        let paidManuallyCount = 0;
        let unresolvedCount = 0;
        for (const w of snapshot) {
          const st = payoutState[w.pubkey]?.status;
          if (st === "sent") paidViaWalletCount += 1;
          else if (st === "marked_paid") paidManuallyCount += 1;
          else unresolvedCount += 1;
        }
        const satsPlanned = budgetSatsFromGiveawayRow(g);
        const satsPaid = totalSatsPaidFromState(snapshot, payoutState);
        const meta = g.lastPreviewMeta as { eligiblePoolSize?: number } | null;
        const completedAtLabel = new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(g.updatedAt);

        return {
          id: g.id,
          title: giveawayProofTitle(g.name, g.id),
          scopeSummaryLabel,
          statusLabel: formatStatusLabel(g.status),
          winnerCount,
          satsPlanned,
          satsPaid,
          paidViaWalletCount,
          paidManuallyCount,
          unresolvedCount,
          finalizationFeeSats: g.finalizationFeeSats ?? null,
          planAtFinalization: g.planAtFinalization ?? null,
          payoutWalletMode: g.payoutWalletMode,
          payoutAutoRunEnabled: g.payoutAutoRunEnabled,
          completedAtLabel,
          selectionMode: g.selectionMode,
          eligiblePoolSize: meta?.eligiblePoolSize ?? null,
        };
      })
    );
  })();

  if (isRemixResourceRequest(request)) {
    return json({ giveaways: await giveawaysPromise });
  }

  return defer({ giveaways: giveawaysPromise });
}

export default function GiveawayProofPage() {
  const { giveaways } = useLoaderData<typeof loader>();

  return (
    <Suspense fallback={<GiveawayProofPageSkeleton />}>
      <Await
        resolve={giveaways}
        errorElement={
          <DeferredRouteAwaitError retryTo="/dashboard/giveaway/proof" />
        }
      >
        {(loadedGiveaways) => (
          <div className="space-y-6">
            <GiveawayProofStudio giveaways={loadedGiveaways} />
            <p className="text-text-secondary text-sm">
              <Link
                to="/dashboard/giveaway"
                className="text-brand hover:underline"
              >
                ← All giveaways
              </Link>
            </p>
          </div>
        )}
      </Await>
    </Suspense>
  );
}
