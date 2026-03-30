/**
 * Pure string builders for campaign rail outcome lines (no domain logic).
 */

export function buildGiveawayOutcomeLine(args: {
  plannedPayoutSats: number | null;
  winnerCount: number;
}): string {
  const { plannedPayoutSats, winnerCount } = args;
  const w = winnerCount !== 1 ? "s" : "";
  if (plannedPayoutSats != null && plannedPayoutSats > 0) {
    return `Up to ${plannedPayoutSats.toLocaleString()} sats across ${winnerCount} winner${w}.`;
  }
  return `Selection-only · ${winnerCount} winner${w}.`;
}

export function buildContestOutcomePoolLine(args: {
  plannedPayoutSats: number;
  winnerCount: number;
}): string {
  const w = args.winnerCount !== 1 ? "s" : "";
  return `${args.plannedPayoutSats.toLocaleString()} sats pool · ${args.winnerCount} winner${w}`;
}
