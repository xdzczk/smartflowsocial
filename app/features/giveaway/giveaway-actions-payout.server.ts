import {
  PAYOUT_SKIP_NOTE_PAYOUT_UNAVAILABLE,
  PAYOUT_SKIP_NOTE_WALLET_NOT_CONNECTED,
} from "~/features/payments/payout-skip-messages.server";
import { listPayoutItemsByRunId } from "~/features/payments/repositories/payout-ledger-data.server";

import {
  executeCampaignPayoutBatch,
  executeCampaignPayoutBatchStep,
} from "../payments/services/payout-executor.server";

import type { Prisma } from "./data/giveaway-prisma-types.server";
import { getGiveawayById } from "./giveaway-actions-crud.server";
import { ERROR_GIVEAWAY_NOT_FOUND } from "./giveaway-actions-shared.server";
import { appendGiveawayActivityLog } from "./giveaway-activity-log.server";
import {
  normalizePayoutState,
  resolveWinnerSatsPerWinner,
} from "./giveaway-payout.server";
import type { GiveawayPayoutEntryStatus } from "./giveaway-payout.server";
import { updateGiveaway as updateGiveawayRow } from "./repositories/giveaway-actions-data.server";
import type { GiveawayWinnerEntry } from "./types";

function syncPayoutStateFromLedgerItems(args: {
  state: ReturnType<typeof normalizePayoutState>;
  snapshot: GiveawayWinnerEntry[];
  itemByPubkey: Map<string, { status: string; errorMessage: string | null }>;
  nowIso: string;
}) {
  const { state, snapshot, itemByPubkey, nowIso } = args;
  for (const w of snapshot) {
    const item = itemByPubkey.get(w.pubkey);
    if (!item) continue;
    if (item.status === "paid") {
      state[w.pubkey] = { status: "sent", updatedAt: nowIso };
    } else if (item.status === "failed") {
      state[w.pubkey] = {
        status: "failed",
        updatedAt: nowIso,
        note: item.errorMessage ?? undefined,
      };
    } else if (item.status === "claim_needed") {
      state[w.pubkey] = {
        status: "claim_needed",
        updatedAt: nowIso,
        note: item.errorMessage ?? "Winner needs claim",
      };
    } else if (item.status === "skipped") {
      state[w.pubkey] = {
        status: "skipped",
        updatedAt: nowIso,
        note: item.errorMessage ?? undefined,
      };
    }
  }
}

export async function setGiveawayWinnerPayoutStatus(
  userId: string,
  giveawayId: string,
  winnerPubkey: string,
  status: GiveawayPayoutEntryStatus,
  note?: string | null
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "LOCKED") {
    return {
      success: false,
      error: "Payout status can only be changed while the giveaway is locked",
    };
  }
  const snapshot = g.winnerSnapshot as GiveawayWinnerEntry[] | null;
  if (!snapshot?.some((w) => w.pubkey === winnerPubkey)) {
    return { success: false, error: "Winner not in locked set" };
  }
  const state = normalizePayoutState(g.payoutState, snapshot);
  const next: (typeof state)[string] = {
    status,
    updatedAt: new Date().toISOString(),
  };
  if (note != null && note.trim() !== "") {
    next.note = note.trim();
  }
  state[winnerPubkey] = next;
  await updateGiveawayRow(giveawayId, {
    payoutState: state as unknown as Prisma.InputJsonValue,
  });
  return { success: true };
}

export async function runGiveawayPayoutBatchWithNwc(
  userId: string,
  giveawayId: string,
  options?: { trigger?: "manual_trigger" | "autorun"; spendCapSats?: number }
): Promise<{
  success: boolean;
  error?: string;
  runId?: string | null;
  code?: string;
}> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "LOCKED") {
    return {
      success: false,
      error: "Giveaway must be locked to run payouts",
    };
  }
  const snapshot = (g.winnerSnapshot as GiveawayWinnerEntry[] | null) ?? [];
  if (snapshot.length === 0)
    return { success: false, error: "No winners to pay" };

  const exec = await executeCampaignPayoutBatch({
    scope: "GIVEAWAY",
    giveawayId,
    creatorUserId: userId,
    trigger: options?.trigger ?? "manual_trigger",
    walletMode: "nwc_creator",
    spendCapSats: options?.spendCapSats ?? null,
    winners: snapshot.map((w) => ({
      winnerPubkeyHex: w.pubkey,
      amountSats: resolveWinnerSatsPerWinner(w, {
        engagementConfig: g.engagementConfig,
        winnerCount: g.winnerCount,
        plannedPayoutSats: g.plannedPayoutSats,
      }),
      winnerNpub: w.npub,
    })),
  });

  const items = exec.runId ? await listPayoutItemsByRunId(exec.runId) : [];
  const itemByPubkey = new Map(items.map((i) => [i.winnerPubkey, i]));

  const state = normalizePayoutState(g.payoutState, snapshot);
  const now = new Date().toISOString();
  syncPayoutStateFromLedgerItems({
    state,
    snapshot,
    itemByPubkey: itemByPubkey,
    nowIso: now,
  });
  if (!exec.eligible) {
    const note =
      exec.eligibilityErrorCode === "nwc_not_connected"
        ? PAYOUT_SKIP_NOTE_WALLET_NOT_CONNECTED
        : PAYOUT_SKIP_NOTE_PAYOUT_UNAVAILABLE;
    for (const w of snapshot) {
      const current = state[w.pubkey]?.status ?? "pending";
      if (current === "pending" || current === "claim_needed") {
        state[w.pubkey] = {
          status: "skipped",
          updatedAt: now,
          note,
        };
      }
    }
  }

  await updateGiveawayRow(giveawayId, {
    payoutState: state as unknown as Prisma.InputJsonValue,
    activityLog: appendGiveawayActivityLog(
      g.activityLog,
      "payout_batch_executed",
      {
        runId: exec.runId,
        eligible: exec.eligible,
        walletMode: exec.walletMode,
        totals: exec.totals,
        eligibilityErrorCode: exec.eligibilityErrorCode,
      }
    ),
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

export async function runGiveawayPayoutBatchStepWithNwc(
  userId: string,
  giveawayId: string,
  stepIndex: number,
  options?: { trigger?: "manual_trigger" | "autorun"; spendCapSats?: number }
): Promise<
  | { success: false; error: string }
  | ({ success: true } & Awaited<
      ReturnType<typeof executeCampaignPayoutBatchStep>
    >)
> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "LOCKED") {
    return {
      success: false,
      error: "Giveaway must be locked to run payouts",
    };
  }
  const snapshot = (g.winnerSnapshot as GiveawayWinnerEntry[] | null) ?? [];
  if (snapshot.length === 0)
    return { success: false, error: "No winners to pay" };

  const exec = await executeCampaignPayoutBatchStep(
    {
      scope: "GIVEAWAY",
      giveawayId,
      creatorUserId: userId,
      trigger: options?.trigger ?? "manual_trigger",
      walletMode: "nwc_creator",
      spendCapSats: options?.spendCapSats ?? null,
      winners: snapshot.map((w) => ({
        winnerPubkeyHex: w.pubkey,
        amountSats: resolveWinnerSatsPerWinner(w, {
          engagementConfig: g.engagementConfig,
          winnerCount: g.winnerCount,
          plannedPayoutSats: g.plannedPayoutSats,
        }),
        winnerNpub: w.npub,
      })),
    },
    stepIndex
  );

  const items = exec.runId ? await listPayoutItemsByRunId(exec.runId) : [];
  const itemByPubkey = new Map(items.map((i) => [i.winnerPubkey, i]));

  const state = normalizePayoutState(g.payoutState, snapshot);
  const now = new Date().toISOString();
  syncPayoutStateFromLedgerItems({
    state,
    snapshot,
    itemByPubkey: itemByPubkey,
    nowIso: now,
  });
  if (!exec.eligible) {
    const note =
      exec.eligibilityErrorCode === "nwc_not_connected"
        ? PAYOUT_SKIP_NOTE_WALLET_NOT_CONNECTED
        : PAYOUT_SKIP_NOTE_PAYOUT_UNAVAILABLE;
    for (const w of snapshot) {
      const current = state[w.pubkey]?.status ?? "pending";
      if (current === "pending" || current === "claim_needed") {
        state[w.pubkey] = {
          status: "skipped",
          updatedAt: now,
          note,
        };
      }
    }
  }

  await updateGiveawayRow(giveawayId, {
    payoutState: state as unknown as Prisma.InputJsonValue,
    ...(exec.done
      ? {
          activityLog: appendGiveawayActivityLog(
            g.activityLog,
            "payout_batch_executed",
            {
              runId: exec.runId,
              eligible: exec.eligible,
              walletMode: exec.walletMode,
              totals: exec.totals,
              eligibilityErrorCode: exec.eligibilityErrorCode,
              stepped: true,
            }
          ),
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

export async function updateGiveawayPayoutSettings(
  userId: string,
  giveawayId: string,
  settings: {
    payoutWalletMode?: "manual" | "nwc_creator";
    payoutAutoRunEnabled?: boolean;
    payoutAutoRunSpendCapSats?: number | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status === "PAID_OUT" || g.status === "CANCELLED") {
    return {
      success: false,
      error: "Cannot change payout settings after completion/cancel",
    };
  }

  const next: Prisma.GiveawayUpdateInput = {};
  if (settings.payoutWalletMode) {
    next.payoutWalletMode = settings.payoutWalletMode;
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

  await updateGiveawayRow(giveawayId, {
    ...next,
    activityLog: appendGiveawayActivityLog(
      g.activityLog,
      "payout_settings_updated",
      {}
    ),
  });
  return { success: true };
}
