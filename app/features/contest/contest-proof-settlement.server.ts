import { normalizeContestPayoutState } from "./contest-payout.server";
import { findContestWinnersWithEntries } from "./repositories/contest-detail-queries.server";

export interface ContestProofSettlementSummary {
  paidViaWalletCount: number;
  paidManuallyCount: number;
  unresolvedCount: number;
  satsPaid: number;
}

/**
 * Payout breakdown for proof cards  -  aligns with contest detail aggregation.
 */
export async function summarizeContestProofSettlement(
  contestId: string,
  payoutStateRaw: unknown
): Promise<ContestProofSettlementSummary> {
  const winnersRaw = await findContestWinnersWithEntries(contestId);
  const primary = winnersRaw.filter((w) => !w.isAlternate);
  const winnerPubkeys = primary.map((w) => w.entry.authorPubkey);
  const payoutState = normalizeContestPayoutState(
    payoutStateRaw,
    winnerPubkeys
  );

  let paidViaWallet = 0;
  let paidManually = 0;
  let unresolved = 0;
  let satsPaid = 0;

  for (const w of primary) {
    const pk = w.entry.authorPubkey;
    const st = payoutState[pk]?.status ?? "pending";
    const reward = Math.max(0, Math.floor(w.rewardSats));
    if (st === "sent") {
      paidViaWallet += 1;
      satsPaid += reward;
    } else if (st === "marked_paid") {
      paidManually += 1;
      satsPaid += reward;
    } else {
      unresolved += 1;
    }
  }

  return {
    paidViaWalletCount: paidViaWallet,
    paidManuallyCount: paidManually,
    unresolvedCount: unresolved,
    satsPaid,
  };
}
