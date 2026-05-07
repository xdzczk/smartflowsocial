/* eslint-disable no-restricted-imports, import/order, sonarjs/no-duplicate-string, @typescript-eslint/consistent-type-assertions -- Contest payout batch reads winners via prisma (existing boundary). */
import { prisma } from "~/lib/prisma.server";

import {
  PAYOUT_SKIP_NOTE_PAYOUT_UNAVAILABLE,
  PAYOUT_SKIP_NOTE_WALLET_NOT_CONNECTED,
} from "~/features/payments/payout-skip-messages.server";
import { listPayoutItemsByRunId } from "~/features/payments/repositories/payout-ledger-data.server";

import type { Prisma } from "./data/contest-prisma-types.server";
import {
  normalizeContestPayoutState,
  type ContestPayoutEntryStatus,
  type ContestPayoutState,
} from "./contest-payout.server";
import { getContestById } from "./contest-actions-queries.server";
import { updateContest as updateContestRow } from "./repositories/contest-actions-data.server";
import {
  executeCampaignPayoutBatch,
  executeCampaignPayoutBatchStep,
} from "../payments/services/payout-executor.server";

function syncContestPayoutFromLedgerItems(args: {
  state: ContestPayoutState;
  winnerPubkeys: string[];
  itemByPubkey: Map<string, { status: string; errorMessage: string | null }>;
  nowIso: string;
}) {
  const { state, winnerPubkeys, itemByPubkey, nowIso } = args;
  for (const pk of winnerPubkeys) {
    const item = itemByPubkey.get(pk);
    if (!item) continue;
    if (item.status === "paid") {
      state[pk] = { status: "sent", updatedAt: nowIso };
    } else if (item.status === "failed") {
      state[pk] = {
        status: "failed",
        updatedAt: nowIso,
        note: item.errorMessage ?? undefined,
      };
    } else if (item.status === "claim_needed") {
      state[pk] = {
        status: "claim_needed",
        updatedAt: nowIso,
        note: item.errorMessage ?? "Winner needs claim",
      };
    } else if (item.status === "skipped") {
      state[pk] = {
        status: "skipped",
        updatedAt: nowIso,
        note: item.errorMessage ?? undefined,
      };
    }
  }
}

export async function setContestWinnerPayoutStatus(
  userId: string,
  contestId: string,
  winnerPubkey: string,
  status: ContestPayoutEntryStatus,
  note?: string | null
): Promise<{ success: boolean; error?: string }> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (contest.status !== "LOCKED" && contest.status !== "PAYOUT_IN_PROGRESS") {
    return { success: false, error: "Contest is not in payout state" };
  }

  const winners = await prisma.contestWinner.findMany({
    where: { contestId, isAlternate: false },
    include: { entry: true },
  });
  const winnerPubkeys = winners.map((row) => row.entry.authorPubkey);
  if (!winnerPubkeys.includes(winnerPubkey)) {
    return { success: false, error: "Winner not found in locked set" };
  }

  const state = normalizeContestPayoutState(contest.payoutState, winnerPubkeys);
  state[winnerPubkey] = {
    status,
    updatedAt: new Date().toISOString(),
    ...(note?.trim() ? { note: note.trim() } : {}),
  };

  await updateContestRow(contestId, {
    status: "PAYOUT_IN_PROGRESS",
    payoutState: state as unknown as Prisma.InputJsonValue,
    eventLogs: {
      create: {
        eventType: "payout_status_updated",
        message: `Payout status updated (${status})`,
        metadata: {
          winnerPubkey,
          status,
        } as Prisma.InputJsonValue,
      },
    },
  });
  return { success: true };
}

export async function runContestPayoutBatchWithNwc(
  userId: string,
  contestId: string,
  options?: { trigger?: "manual_trigger" | "autorun"; spendCapSats?: number }
): Promise<{
  success: boolean;
  error?: string;
  runId?: string | null;
  code?: string;
}> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (contest.status !== "LOCKED" && contest.status !== "PAYOUT_IN_PROGRESS") {
    return { success: false, error: "Contest is not in payout state" };
  }

  const winners = await prisma.contestWinner.findMany({
    where: { contestId, isAlternate: false },
    include: { entry: true },
    orderBy: { rank: "asc" },
  });

  const winnerPubkeys = winners.map((w) => w.entry.authorPubkey);
  const payoutState = normalizeContestPayoutState(
    contest.payoutState,
    winnerPubkeys
  );

  const exec = await executeCampaignPayoutBatch({
    scope: "CONTEST",
    contestId,
    creatorUserId: userId,
    trigger: options?.trigger ?? "manual_trigger",
    walletMode: "nwc_creator",
    spendCapSats: options?.spendCapSats ?? null,
    winners: winners.map((w) => ({
      winnerPubkeyHex: w.entry.authorPubkey,
      amountSats: w.rewardSats,
      winnerNpub: w.entry.authorNpub ?? null,
    })),
  });

  const items = exec.runId ? await listPayoutItemsByRunId(exec.runId) : [];
  const itemByPubkey = new Map(items.map((i) => [i.winnerPubkey, i]));

  const now = new Date().toISOString();
  syncContestPayoutFromLedgerItems({
    state: payoutState,
    winnerPubkeys,
    itemByPubkey: itemByPubkey as Map<
      string,
      { status: string; errorMessage: string | null }
    >,
    nowIso: now,
  });

  if (!exec.eligible) {
    const note =
      exec.eligibilityErrorCode === "nwc_not_connected"
        ? PAYOUT_SKIP_NOTE_WALLET_NOT_CONNECTED
        : PAYOUT_SKIP_NOTE_PAYOUT_UNAVAILABLE;
    for (const pk of winnerPubkeys) {
      const current = payoutState[pk]?.status ?? "pending";
      if (current === "pending" || current === "claim_needed") {
        payoutState[pk] = {
          status: "skipped",
          updatedAt: now,
          note,
        };
      }
    }
  }

  await updateContestRow(contestId, {
    status: "PAYOUT_IN_PROGRESS",
    payoutState: payoutState as unknown as Prisma.InputJsonValue,
    eventLogs: {
      create: {
        eventType: "payout_batch_executed",
        message: exec.eligible
          ? "Batch payout executed via NWC"
          : "Batch payout skipped (NWC not available)",
        metadata: {
          runId: exec.runId,
          eligible: exec.eligible,
          walletMode: exec.walletMode,
          totals: exec.totals,
          eligibilityErrorCode: exec.eligibilityErrorCode,
        } as Prisma.InputJsonValue,
      },
    },
  });

  if (!exec.eligible) {
    return {
      success: false,
      error:
        exec.eligibilityErrorCode === "nwc_not_connected"
          ? PAYOUT_SKIP_NOTE_WALLET_NOT_CONNECTED
          : PAYOUT_SKIP_NOTE_PAYOUT_UNAVAILABLE,
      code: exec.eligibilityErrorCode,
      runId: exec.runId,
    };
  }

  return { success: true, runId: exec.runId };
}

export async function runContestPayoutBatchStepWithNwc(
  userId: string,
  contestId: string,
  stepIndex: number,
  options?: { trigger?: "manual_trigger" | "autorun"; spendCapSats?: number }
): Promise<
  | { success: false; error: string }
  | ({ success: true } & Awaited<
      ReturnType<typeof executeCampaignPayoutBatchStep>
    >)
> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (contest.status !== "LOCKED" && contest.status !== "PAYOUT_IN_PROGRESS") {
    return { success: false, error: "Contest is not in payout state" };
  }

  const winners = await prisma.contestWinner.findMany({
    where: { contestId, isAlternate: false },
    include: { entry: true },
    orderBy: { rank: "asc" },
  });

  const winnerPubkeys = winners.map((w) => w.entry.authorPubkey);
  const payoutState = normalizeContestPayoutState(
    contest.payoutState,
    winnerPubkeys
  );

  const exec = await executeCampaignPayoutBatchStep(
    {
      scope: "CONTEST",
      contestId,
      creatorUserId: userId,
      trigger: options?.trigger ?? "manual_trigger",
      walletMode: "nwc_creator",
      spendCapSats: options?.spendCapSats ?? null,
      winners: winners.map((w) => ({
        winnerPubkeyHex: w.entry.authorPubkey,
        amountSats: w.rewardSats,
        winnerNpub: w.entry.authorNpub ?? null,
      })),
    },
    stepIndex
  );

  const items = exec.runId ? await listPayoutItemsByRunId(exec.runId) : [];
  const itemByPubkey = new Map(items.map((i) => [i.winnerPubkey, i]));

  const now = new Date().toISOString();
  syncContestPayoutFromLedgerItems({
    state: payoutState,
    winnerPubkeys,
    itemByPubkey: itemByPubkey as Map<
      string,
      { status: string; errorMessage: string | null }
    >,
    nowIso: now,
  });

  if (!exec.eligible) {
    const note =
      exec.eligibilityErrorCode === "nwc_not_connected"
        ? PAYOUT_SKIP_NOTE_WALLET_NOT_CONNECTED
        : PAYOUT_SKIP_NOTE_PAYOUT_UNAVAILABLE;
    for (const pk of winnerPubkeys) {
      const current = payoutState[pk]?.status ?? "pending";
      if (current === "pending" || current === "claim_needed") {
        payoutState[pk] = {
          status: "skipped",
          updatedAt: now,
          note,
        };
      }
    }
  }

  await updateContestRow(contestId, {
    status: "PAYOUT_IN_PROGRESS",
    payoutState: payoutState as unknown as Prisma.InputJsonValue,
    ...(exec.done
      ? {
          eventLogs: {
            create: {
              eventType: "payout_batch_executed",
              message: exec.eligible
                ? "Batch payout executed via NWC"
                : "Batch payout skipped (NWC not available)",
              metadata: {
                runId: exec.runId,
                eligible: exec.eligible,
                walletMode: exec.walletMode,
                totals: exec.totals,
                eligibilityErrorCode: exec.eligibilityErrorCode,
                stepped: true,
              } as Prisma.InputJsonValue,
            },
          },
        }
      : {}),
  });

  if (!exec.eligible) {
    return {
      success: false,
      error:
        exec.eligibilityErrorCode === "nwc_not_connected"
          ? PAYOUT_SKIP_NOTE_WALLET_NOT_CONNECTED
          : PAYOUT_SKIP_NOTE_PAYOUT_UNAVAILABLE,
    };
  }

  return { success: true, ...exec };
}

export async function updateContestPayoutSettings(
  userId: string,
  contestId: string,
  settings: {
    payoutWalletMode?: "manual" | "nwc_creator";
    payoutAutoRunEnabled?: boolean;
    payoutAutoRunSpendCapSats?: number | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (contest.status === "COMPLETED" || contest.status === "CANCELLED") {
    return {
      success: false,
      error: "Cannot change payout settings after completion/cancel",
    };
  }

  const next: Prisma.ContestUpdateInput = {};
  if (settings.payoutWalletMode) {
    next.payoutWalletMode = settings.payoutWalletMode;
    // If user selects manual, force-disable autorun.
    if (settings.payoutWalletMode === "manual") {
      next.payoutAutoRunEnabled = false;
    }
  }
  if (settings.payoutAutoRunEnabled !== undefined) {
    next.payoutAutoRunEnabled = settings.payoutAutoRunEnabled;
  }
  if (settings.payoutAutoRunSpendCapSats !== undefined) {
    next.payoutAutoRunSpendCapSats = settings.payoutAutoRunSpendCapSats;
  }
  if (Object.keys(next).length === 0) return { success: true };

  await updateContestRow(contestId, {
    ...next,
    eventLogs: {
      create: {
        eventType: "payout_settings_updated",
        message: "Payout settings updated",
      },
    },
  });
  return { success: true };
}

/* eslint-enable no-restricted-imports, import/order, sonarjs/no-duplicate-string, @typescript-eslint/consistent-type-assertions */
