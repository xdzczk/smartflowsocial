import { poweredByBrand } from "~/lib/brand";

/**
 * Human-readable fairness highlights for sharing (mirrors giveaway proof cards).
 */
export function buildContestFairnessProofLines(input: {
  title: string;
  eligibleEntries?: number | null;
  tieBreakRule: string | null;
  entryType: string;
  lockedOrCompletedAt: string;
}): string[] {
  return [
    `Fairness · ${input.title}`,
    input.eligibleEntries != null
      ? `Eligible entries (frozen snapshot): ${input.eligibleEntries}`
      : "Eligible entries (frozen snapshot):  - ",
    `Entry type: ${input.entryType}`,
    input.tieBreakRule ? `Tie-break: ${input.tieBreakRule}` : "Tie-break:  - ",
    `Locked / completed: ${input.lockedOrCompletedAt}`,
    "",
    poweredByBrand,
  ];
}

export function buildContestReceiptSummaryLine(input: {
  sourceNoteId: string;
  rankingMetric: string;
  winnerCount: number;
  plannedPayoutSats: number;
  finalizationFeeSats: number;
  completedAtLabel: string;
}): string {
  return `Completed contest on ${input.sourceNoteId.slice(0, 12)}... by ${input.rankingMetric.toLowerCase()} with ${input.winnerCount} winner(s), ${input.plannedPayoutSats.toLocaleString()} sats planned, ${input.finalizationFeeSats.toLocaleString()} sats fee, completed ${input.completedAtLabel}.`;
}

export function buildContestPublicSummaryLines(input: {
  title: string;
  rankingMetric: string;
  winnerCount: number;
  plannedPayoutSats: number;
  durationLabel: string;
  completedAtLabel?: string;
}): string[] {
  const lines = [
    `Completed ${input.title}`,
    `Top ${input.winnerCount} replies ranked by ${input.rankingMetric.toLowerCase()} over ${input.durationLabel}.`,
    `Planned payout: ${input.plannedPayoutSats.toLocaleString()} sats.`,
    "Results are based on the frozen snapshot captured at contest end.",
  ];
  if (input.completedAtLabel) {
    lines.push("", `Completed: ${input.completedAtLabel}`);
  }
  lines.push("", poweredByBrand);
  return lines;
}
