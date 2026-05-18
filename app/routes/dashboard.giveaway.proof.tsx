import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import type { GiveawayWinnerEntry } from "~/features/giveaway";
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
import { proofStudioShouldRevalidate } from "~/lib/proof/proof-studio-should-revalidate";
export { proofStudioShouldRevalidate as shouldRevalidate };

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
        const satsPaid = totalSatsPaidFromState(snapshot, payoutState, {
          engagementConfig: g.engagementConfig,
          winnerCount: g.winnerCount,
          plannedPayoutSats: g.plannedPayoutSats,
        });
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

  const giveaways = await giveawaysPromise;
  return json({ giveaways });
}

export default function GiveawayProofPage() {
  const { giveaways } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <GiveawayProofStudio giveaways={giveaways} />
      <p className="text-text-secondary text-sm">
        <Link
          to="/dashboard/giveaway"
          className="text-link hover:text-link-hover hover:underline"
        >
          ← All giveaways
        </Link>
      </p>
    </div>
  );
}
