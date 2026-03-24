import { useEffect, useState } from "react";

import { contestCopy } from "../contest-copy";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export function ContestLiveHeader({
  contestEndAtIso,
  rankingMetric,
  winnerCount,
  plannedPayoutSats,
  totalEntries,
}: {
  contestEndAtIso: string;
  rankingMetric: string;
  winnerCount: number;
  plannedPayoutSats: number;
  totalEntries: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(contestEndAtIso).getTime();
  const remaining = end - now;

  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
          Live
        </span>
        <span className="text-muted-foreground text-sm">
          Ends {new Date(contestEndAtIso).toLocaleString()}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {formatRemaining(remaining)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{contestCopy.statsStrip}</dt>
          <dd className="font-medium">{rankingMetric}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Winner slots</dt>
          <dd className="font-medium">{winnerCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Entries</dt>
          <dd className="font-medium">{totalEntries}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Planned pool</dt>
          <dd className="font-medium">
            {plannedPayoutSats.toLocaleString()} sats
          </dd>
        </div>
      </dl>
    </div>
  );
}
