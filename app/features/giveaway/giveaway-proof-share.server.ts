/**
 * Text proof lines for sharing completed giveaways (no image rendering here).
 * Public copy intentionally omits finalization fees (platform economics).
 */

export function buildGiveawayPublicSummaryLines(input: {
  title: string;
  scopeLine: string;
  winnerCount: number;
  budgetSats: number;
  completedAtLabel: string;
}): string[] {
  const payoutPhrase =
    input.budgetSats > 0
      ? `${input.budgetSats.toLocaleString()} sats planned payout`
      : "winners only (no planned sats)";
  return [
    `Completed a SmartFlowSocial giveaway: ${input.winnerCount} winner${input.winnerCount === 1 ? "" : "s"} selected from ${input.scopeLine}, ${payoutPhrase}, finalized fairly with audit trail.`,
    "",
    input.title,
    `Completed: ${input.completedAtLabel}`,
    "",
    "Powered by SmartFlow Social",
  ];
}

/** One-line receipt for copy (includes fee and plan for the organizer). */
export function buildGiveawayReceiptSummaryLine(input: {
  scopeSummaryLabel: string;
  winnerCount: number;
  plannedPayoutSats: number;
  finalizationFeeSats: number;
  planAtFinalization: string | null;
  completedAtLabel: string;
}): string {
  const planTrim = input.planAtFinalization?.trim();
  const plan = planTrim && planTrim.length > 0 ? planTrim : "—";
  return `${input.scopeSummaryLabel} · ${input.winnerCount} winner${input.winnerCount === 1 ? "" : "s"} · ${input.plannedPayoutSats.toLocaleString()} sats planned · ${input.finalizationFeeSats.toLocaleString()} sats finalization fee · Plan: ${plan} · Completed ${input.completedAtLabel}`;
}

export function buildGiveawayFairnessProofLines(input: {
  title: string;
  eligiblePoolSize?: number;
  selectionModeLabel: string;
  lockedOrCompletedAt: string;
}): string[] {
  return [
    `Fairness · ${input.title}`,
    input.eligiblePoolSize != null
      ? `Eligible pool (last preview): ${input.eligiblePoolSize}`
      : "Eligible pool: —",
    `Selection: ${input.selectionModeLabel}`,
    `Locked / completed: ${input.lockedOrCompletedAt}`,
    "",
    "Powered by SmartFlow Social",
  ];
}
