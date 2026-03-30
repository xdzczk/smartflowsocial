import { contestCopy } from "../contest-copy";
import type {
  ContestLeaderboardEntryRow,
  ContestLeaderboardRow,
  ContestLivePreviewRow,
  ContestProfileMap,
  ContestWinnerRow,
} from "../contest-detail-ui.types";
import type { ContestRankingMetric } from "../types";

function MetricCells({
  metric,
  row,
}: {
  metric: ContestRankingMetric;
  row: Pick<
    ContestLeaderboardEntryRow | ContestLivePreviewRow,
    | "reactionsCount"
    | "zapCount"
    | "satsZapped"
    | "repliesCount"
    | "repostsCount"
    | "score"
  >;
}) {
  return (
    <span className="text-muted-foreground text-xs">
      {metric === "REACTIONS" ? <>R {row.reactionsCount}</> : null}
      {metric === "ZAPS" ? <>Z {row.zapCount}</> : null}
      {metric === "SATS_ZAPPED" ? <>⚡ {row.satsZapped}</> : null}
      {metric === "REPLIES" ? <>↩ {row.repliesCount}</> : null}
      {metric === "REPOSTS" ? <>🔁 {row.repostsCount}</> : null}
    </span>
  );
}

export function ContestLeaderboard({
  title = contestCopy.leaderboard,
  metric,
  winnerCount,
  profiles,
  winners,
  rows,
  mode,
}: {
  title?: string;
  metric: ContestRankingMetric;
  winnerCount: number;
  profiles: ContestProfileMap;
  winners: ContestWinnerRow[];
  rows: ContestLeaderboardRow[];
  mode: "live" | "frozen";
}) {
  const winnerByEvent = new Map(winners.map((w) => [w.entryEventId, w]));

  const liveLeaderboardTitle =
    mode === "live" ? `${title} — top ${winnerCount} in the money` : title;

  return (
    <div
      className={`border-border bg-card overflow-hidden rounded-lg border ${mode === "live" ? "shadow-md shadow-blue-500/5" : ""}`}
    >
      <div className="border-border border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{liveLeaderboardTitle}</h2>
        {mode === "live" ? (
          <p className="text-muted-foreground mt-0.5 text-xs">
            Positions update live; prize row highlights follow your winner
            count.
          </p>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-4 py-6 text-sm">
          No entries yet.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {rows.map((row, idx) => {
            const rank = row.rank ?? idx + 1;
            const w = winnerByEvent.get(row.entryEventId);
            const prof = profiles[row.authorPubkey];
            const npubShort = prof?.npub
              ? `${prof.npub.slice(0, 12)}…`
              : `${row.authorPubkey.slice(0, 8)}…`;
            const isTop3 = rank <= 3;
            const medal =
              mode === "live" && rank === 1
                ? "🥇"
                : mode === "live" && rank === 2
                  ? "🥈"
                  : mode === "live" && rank === 3
                    ? "🥉"
                    : null;
            const inPrizeZone = mode === "live" && rank <= winnerCount;
            const isWinnerSlot = Boolean(w && !w.isAlternate);
            const showCutoff =
              mode === "frozen" && rank === winnerCount + 1 && winnerCount > 0;

            return (
              <li key={row.entryEventId}>
                {showCutoff ? (
                  <div className="bg-muted/50 text-muted-foreground px-4 py-2 text-center text-xs">
                    {contestCopy.cutoffLine(winnerCount)}
                  </div>
                ) : null}
                <div
                  className={`flex gap-3 px-4 py-3 ${
                    mode === "live" && inPrizeZone
                      ? "border-l-primary/50 from-primary/10 bg-gradient-to-r to-transparent"
                      : isTop3
                        ? "bg-primary/5"
                        : ""
                  }`}
                >
                  <div
                    className="w-9 shrink-0 text-center text-sm font-bold"
                    title={medal ? `Rank ${rank}` : undefined}
                  >
                    {medal ? (
                      <span className="text-lg leading-none" aria-hidden>
                        {medal}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{rank}</span>
                    )}
                  </div>
                  <div className="bg-muted h-10 w-10 shrink-0 overflow-hidden rounded-full">
                    {prof?.picture ? (
                      <img
                        src={prof.picture}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs">
                        ?
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {prof?.displayName ?? npubShort}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {npubShort}
                      </span>
                      {w?.isAlternate ? (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs">
                          Alternate
                        </span>
                      ) : null}
                      {isWinnerSlot && w ? (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs">
                          {w.rewardSats.toLocaleString()} sats
                        </span>
                      ) : null}
                      {isWinnerSlot ? (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs">
                          Winning
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground truncate text-sm">
                      {row.replySnippet ?? "(no text)"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-medium tabular-nums">
                        Score: {row.score}
                      </span>
                      <MetricCells metric={metric} row={row} />
                      {"createdAtUnix" in row ? (
                        <span className="text-muted-foreground text-xs">
                          {new Date(row.createdAtUnix * 1000).toLocaleString()}
                        </span>
                      ) : null}
                      <a
                        href={`https://njump.me/${row.entryEventId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary text-xs hover:underline"
                      >
                        Open reply
                      </a>
                      <a
                        href={
                          prof?.npub
                            ? `https://njump.me/${prof.npub}`
                            : `https://njump.me/${row.authorPubkey}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary text-xs hover:underline"
                      >
                        Open profile
                      </a>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
