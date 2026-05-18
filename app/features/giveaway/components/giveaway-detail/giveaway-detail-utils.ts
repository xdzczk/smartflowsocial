import { computeGiveawayPlannedPayoutSats } from "~/features/giveaway/giveaway-payout.server";
import type { GiveawayWinnerEntry } from "~/features/giveaway/types";

export const PAID_VIA_WALLET_PHASE = "Paid via wallet";
export const PAID_MANUALLY_PHASE = "Paid manually";
export const NEEDS_REVIEW_PHASE = "Needs review";

export function budgetFromSnapshot(
  snap: GiveawayWinnerEntry[],
  context?: {
    engagementConfig: unknown;
    winnerCount?: number;
    plannedPayoutSats?: number | null;
  }
): number {
  if (context) {
    return computeGiveawayPlannedPayoutSats({
      winnerSnapshot: snap,
      ...context,
    });
  }
  return snap.reduce((a, w) => a + (w.satsPerWinner ?? 0), 0);
}

export function winnerEngagementBadges(w: GiveawayWinnerEntry): string[] {
  const kinds = new Set(w.qualifyingActions.map((a) => a.kind));
  const out: string[] = [];
  if (kinds.has(7)) out.push("Reaction");
  if (kinds.has(6)) out.push("Repost");
  if (kinds.has(1)) out.push("Comment");
  if (kinds.has(9735)) out.push("Zap");
  if (w.engagementType) out.push(String(w.engagementType));
  return out.length ? out : ["Participant"];
}
