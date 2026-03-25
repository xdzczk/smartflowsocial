import type { ContestRankingMetric } from "../types";

export function ContestStatsStrip({
  metric,
  totalEntries,
  uniqueParticipants,
  leadingScore,
  aggregates,
}: {
  metric: ContestRankingMetric;
  totalEntries: number;
  uniqueParticipants: number;
  leadingScore: number;
  aggregates: {
    totalReactions: number;
    totalZaps: number;
    totalSatsZapped: number;
  };
}) {
  const metricLabel =
    metric === "REACTIONS"
      ? "Reactions (sum)"
      : metric === "ZAPS"
        ? "Zaps (sum)"
        : "Sats zapped (sum)";
  const metricValue =
    metric === "REACTIONS"
      ? aggregates.totalReactions
      : metric === "ZAPS"
        ? aggregates.totalZaps
        : aggregates.totalSatsZapped;

  return (
    <div className="border-border bg-muted/30 grid grid-cols-2 gap-3 rounded-xl border p-4 text-sm shadow-sm sm:grid-cols-4">
      <div>
        <p className="text-muted-foreground">Total entries</p>
        <p className="text-lg font-semibold tabular-nums">{totalEntries}</p>
      </div>
      <div>
        <p className="text-muted-foreground">Unique participants</p>
        <p className="text-lg font-semibold tabular-nums">
          {uniqueParticipants}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground">Leading score</p>
        <p className="text-lg font-semibold tabular-nums">{leadingScore}</p>
      </div>
      <div>
        <p className="text-muted-foreground">{metricLabel}</p>
        <p className="text-lg font-semibold tabular-nums">{metricValue}</p>
      </div>
    </div>
  );
}
