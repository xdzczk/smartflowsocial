import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  formatContestStatusLabel,
  listContestsFiltered,
} from "~/features/contest";
import { summarizeContestProofSettlement } from "~/features/contest/contest-proof-settlement.server";
import type { Contest } from "~/features/contest/data/contest-prisma-types.server";
import { findLatestContestSnapshot } from "~/features/contest/repositories/contest-detail-queries.server";
import { requireAnySubscription } from "~/features/payments";
import { ContestProofStudio } from "~/features/proof/contest/ContestProofStudio";
import { featureFlags } from "~/lib/feature-flags.server";
import type { ContestProofStudioDto } from "~/lib/proof/adapters/contest";
import { proofStudioShouldRevalidate } from "~/lib/proof/proof-studio-should-revalidate";
export { proofStudioShouldRevalidate as shouldRevalidate };

function contestProofTitle(
  name: string | null | undefined,
  id: string
): string {
  const trimmed = name?.trim();
  if (trimmed === undefined || trimmed === "") {
    return `Contest ${id.slice(0, 8)}`;
  }
  return trimmed;
}

function contestDurationLabel(contest: Contest): string {
  const start = contest.contestStartAt ?? contest.createdAt;
  const ms = contest.contestEndAt.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "the contest window";
  const h = Math.round(ms / 3600000);
  if (h < 48) return `${Math.max(1, h)} hour(s)`;
  const d = Math.round(h / 24);
  return `${d} day(s)`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);

  const contestsPromise = (async (): Promise<ContestProofStudioDto[]> => {
    const completed = await listContestsFiltered(userId, {
      status: "COMPLETED",
      sort: "completed",
    });

    return Promise.all(
      completed.map(async (c) => {
        const snap = await findLatestContestSnapshot(c.id);
        const settlement = await summarizeContestProofSettlement(
          c.id,
          c.payoutState
        );
        const title = contestProofTitle(c.title, c.id);
        const completedAt = c.completedAt ?? c.updatedAt;
        const completedAtLabel = new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(completedAt);
        const planned = c.plannedPayoutSats ?? 0;

        return {
          id: c.id,
          title,
          rankingMetric: c.rankingMetric,
          statusLabel: formatContestStatusLabel("COMPLETED"),
          winnerCount: c.winnerCount,
          satsPlanned: planned,
          satsPaid: settlement.satsPaid,
          paidViaWalletCount: settlement.paidViaWalletCount,
          paidManuallyCount: settlement.paidManuallyCount,
          unresolvedCount: settlement.unresolvedCount,
          finalizationFeeSats: c.finalizationFeeSats ?? null,
          planAtFinalization: c.planAtFinalization ?? null,
          payoutWalletMode: c.payoutWalletMode,
          payoutAutoRunEnabled: c.payoutAutoRunEnabled,
          completedAtLabel,
          tieBreakRule: c.tieBreakRule ?? null,
          entryType: c.entryType,
          eligibleEntries: snap?.eligibleEntries ?? null,
          durationLabel: contestDurationLabel(c),
        };
      })
    );
  })();

  const contests = await contestsPromise;
  return json({ contests });
}

export default function ContestProofPage() {
  const { contests } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <ContestProofStudio contests={contests} />
      <p className="text-text-secondary text-sm">
        <Link
          to="/dashboard/contests"
          className="text-link hover:text-link-hover hover:underline"
        >
          ← All contests
        </Link>
      </p>
    </div>
  );
}
