import { getUserSubscription } from "~/features/payments/data";
import type { UserSubscription } from "~/features/payments/types";
import { getPlanDisplayName, getUserPlanType } from "~/features/payments/types";

import { Prisma } from "./data/giveaway-prisma-types.server";
import { getGiveawayById } from "./giveaway-actions-crud.server";
import { ERROR_GIVEAWAY_NOT_FOUND } from "./giveaway-actions-shared.server";
import { appendGiveawayActivityLog } from "./giveaway-activity-log.server";
import { quoteGiveawayFinalization } from "./giveaway-finalization-fee.server";
import {
  allWinnersPayoutSettled,
  buildInitialPayoutState,
  normalizePayoutState,
} from "./giveaway-payout.server";
import { updateGiveaway as updateGiveawayRow } from "./repositories/giveaway-actions-data.server";
import { findPaidFinalizationForLock } from "./repositories/giveaway-finalization-payment.server";
import type { GiveawayWinnerEntry } from "./types";

export async function lockGiveaway(
  userId: string,
  giveawayId: string,
  options?: { lockConfigHash?: string }
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };

  if (g.status === "LOCKED") {
    return { success: true };
  }

  if (g.status !== "PREVIEWED") {
    return { success: false, error: "Only previewed giveaways can be locked" };
  }

  const snapshot = g.winnerSnapshot as GiveawayWinnerEntry[] | null;
  if (!snapshot?.length) return { success: false, error: "No winners to lock" };

  const subscription = await getUserSubscription(userId);
  const planType = getUserPlanType(subscription as UserSubscription | null);
  const quote = quoteGiveawayFinalization({
    giveaway: {
      winnerSnapshot: g.winnerSnapshot,
      engagementConfig: g.engagementConfig,
      winnerCount: g.winnerCount,
      plannedPayoutSats: g.plannedPayoutSats,
      selectionMode: g.selectionMode,
      scopeType: g.scopeType,
      scopeReference: g.scopeReference,
      engagementTypes: g.engagementTypes,
      filters: g.filters,
      engagementWeights: g.engagementWeights,
    },
    planType,
  });

  if (
    options?.lockConfigHash !== undefined &&
    options.lockConfigHash !== quote.lockConfigHash
  ) {
    return {
      success: false,
      error:
        "This preview changed. Refresh the page and confirm lock again (your paid fee still applies to the same preview).",
    };
  }

  if (quote.feeSats > 0) {
    const paid = await findPaidFinalizationForLock(
      giveawayId,
      userId,
      quote.lockConfigHash
    );
    if (!paid) {
      return {
        success: false,
        error:
          "Pay the finalization fee before locking winners, or refresh if you already paid.",
      };
    }
  }

  const planLabel = getPlanDisplayName(subscription as UserSubscription | null);
  const lockedAt = new Date();

  let finalizationFeeStatus: "NONE" | "PENDING" | "PAID" | "WAIVED";
  if (quote.plannedPayoutSats <= 0) {
    finalizationFeeStatus = "NONE";
  } else if (quote.feeSats <= 0) {
    finalizationFeeStatus = "WAIVED";
  } else {
    finalizationFeeStatus = "PAID";
  }

  await updateGiveawayRow(giveawayId, {
    status: "LOCKED",
    lockedAt,
    lockedByUserId: userId,
    plannedPayoutSats: quote.plannedPayoutSats,
    finalizationFeeRateBps: quote.feeRateBps,
    finalizationFeeSats: quote.feeSats,
    finalizationFeeStatus,
    planAtFinalization: planLabel,
    lockConfigHash: quote.lockConfigHash,
    payoutState: buildInitialPayoutState(
      snapshot
    ) as unknown as Prisma.InputJsonValue,
    activityLog: appendGiveawayActivityLog(g.activityLog, "giveaway_locked", {
      lockedAt: lockedAt.toISOString(),
      plannedPayoutSats: quote.plannedPayoutSats,
      finalizationFeeSats: quote.feeSats,
      finalizationFeeStatus,
      planAtFinalization: planLabel,
    }),
  });
  return { success: true };
}

export async function cancelGiveaway(
  userId: string,
  giveawayId: string
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status === "LOCKED" || g.status === "PAID_OUT")
    return { success: false, error: "Cannot cancel locked or paid giveaway" };

  await updateGiveawayRow(giveawayId, {
    status: "CANCELLED",
    activityLog: appendGiveawayActivityLog(g.activityLog, "cancelled"),
  });
  return { success: true };
}

/** Clear preview snapshot and return to draft so rules can be edited. */
export async function resetGiveawayToDraft(
  userId: string,
  giveawayId: string
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "PREVIEWED") {
    return {
      success: false,
      error: "Only giveaways in preview can be reset to draft",
    };
  }

  await updateGiveawayRow(giveawayId, {
    status: "DRAFT",
    winnerSnapshot: Prisma.JsonNull,
    lastPreviewMeta: Prisma.JsonNull,
    excludedPubkeys: Prisma.JsonNull,
    rerollCount: 0,
    activityLog: appendGiveawayActivityLog(g.activityLog, "reset_to_draft"),
  });
  return { success: true };
}

export async function markGiveawayPaidOut(
  userId: string,
  giveawayId: string,
  options?: { completeOverrideReason?: string }
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "LOCKED")
    return {
      success: false,
      error: "Only locked giveaways can be completed",
    };

  const snapshot = g.winnerSnapshot as GiveawayWinnerEntry[] | null;
  if (!snapshot?.length)
    return { success: false, error: "No winners in giveaway" };

  const state = normalizePayoutState(g.payoutState, snapshot);
  if (!allWinnersPayoutSettled(state, snapshot)) {
    const reason = options?.completeOverrideReason?.trim() ?? "";
    if (reason.length < 10) {
      return {
        success: false,
        error:
          "Mark each winner as sent (or paid) first, or enter a reason (10+ characters) to complete with pending payouts.",
      };
    }
  }

  const completedAt = new Date().toISOString();
  await updateGiveawayRow(giveawayId, {
    status: "PAID_OUT",
    activityLog: appendGiveawayActivityLog(g.activityLog, "completed", {
      completedAt,
      ...(options?.completeOverrideReason
        ? { overrideReason: options.completeOverrideReason }
        : {}),
    }),
  });
  return { success: true };
}
