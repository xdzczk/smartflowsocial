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
}): string[] {
  return [
    `Completed ${input.title}`,
    `Top ${input.winnerCount} replies ranked by ${input.rankingMetric.toLowerCase()} over ${input.durationLabel}.`,
    `Planned payout: ${input.plannedPayoutSats.toLocaleString()} sats.`,
    "Results are based on the frozen snapshot captured at contest end.",
  ];
}
