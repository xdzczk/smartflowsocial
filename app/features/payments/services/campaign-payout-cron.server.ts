import { runContestPayoutBatchWithNwc } from "~/features/contest";
import { runGiveawayPayoutBatchWithNwc } from "~/features/giveaway";
import { findPayoutRunByIdempotencyKey } from "~/features/payments/repositories/payout-ledger-data.server";

import {
  listEligibleContestsForAutorun,
  listEligibleGiveawaysForAutorun,
} from "../repositories/campaign-payout-cron-data.server";

const RUNNING_LEASE_MS = 10 * 60 * 1000;

function campaignIdempotencyKey(
  scope: "CONTEST" | "GIVEAWAY",
  id: string
): string {
  return scope === "CONTEST" ? `contest:${id}` : `giveaway:${id}`;
}

async function hasRecentRunningRun(
  scope: "CONTEST" | "GIVEAWAY",
  id: string
): Promise<boolean> {
  const key = campaignIdempotencyKey(scope, id);
  const run = await findPayoutRunByIdempotencyKey(key);
  if (!run) return false;
  if (run.status !== "running") return false;
  const started = run.startedAt ? run.startedAt.getTime() : null;
  if (!started) return false;
  return Date.now() - started < RUNNING_LEASE_MS;
}

export async function runCampaignPayoutAutorunCron(): Promise<{
  contestsConsidered: number;
  giveawaysConsidered: number;
  contestsAttempted: number;
  giveawaysAttempted: number;
  contestsSkippedLease: number;
  giveawaysSkippedLease: number;
  errors: string[];
}> {
  const now = new Date();
  const [contests, giveaways] = await Promise.all([
    listEligibleContestsForAutorun(now),
    listEligibleGiveawaysForAutorun(),
  ]);

  const result = {
    contestsConsidered: contests.length,
    giveawaysConsidered: giveaways.length,
    contestsAttempted: 0,
    giveawaysAttempted: 0,
    contestsSkippedLease: 0,
    giveawaysSkippedLease: 0,
    errors: [] as string[],
  };

  for (const c of contests) {
    if (await hasRecentRunningRun("CONTEST", c.id)) {
      result.contestsSkippedLease += 1;
      continue;
    }
    result.contestsAttempted += 1;
    try {
      await runContestPayoutBatchWithNwc(c.userId, c.id, {
        trigger: "autorun",
        spendCapSats: c.payoutAutoRunSpendCapSats ?? undefined,
      });
    } catch (e) {
      result.errors.push(
        `contest ${c.id}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  for (const g of giveaways) {
    const lockedAt = g.lockedAt?.getTime() ?? 0;
    if (lockedAt && Date.now() - lockedAt < 30_000) {
      continue;
    }
    if (await hasRecentRunningRun("GIVEAWAY", g.id)) {
      result.giveawaysSkippedLease += 1;
      continue;
    }
    result.giveawaysAttempted += 1;
    try {
      await runGiveawayPayoutBatchWithNwc(g.userId, g.id, {
        trigger: "autorun",
        spendCapSats: g.payoutAutoRunSpendCapSats ?? undefined,
      });
    } catch (e) {
      result.errors.push(
        `giveaway ${g.id}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return result;
}
