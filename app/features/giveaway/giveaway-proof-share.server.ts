/**
 * Text proof lines for sharing completed giveaways (no image rendering here).
 */

export function buildGiveawayPublicSummaryLines(input: {
  title: string;
  scopeLine: string;
  winnerCount: number;
  budgetSats: number;
  completedAtLabel: string;
}): string[] {
  return [
    input.title,
    input.scopeLine,
    `Winners: ${input.winnerCount}`,
    `Sats (planned): ${input.budgetSats.toLocaleString()}`,
    `Completed: ${input.completedAtLabel}`,
    "",
    "Powered by SmartFlow Social",
  ];
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
