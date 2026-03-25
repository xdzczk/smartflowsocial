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
  intro,
}: {
  contestEndAtIso: string;
  rankingMetric: string;
  winnerCount: number;
  plannedPayoutSats: number;
  totalEntries: number;
  intro?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(contestEndAtIso).getTime();
  const remaining = end - now;

  return (
    <div className="border-primary/25 from-primary/8 via-card to-card relative overflow-hidden rounded-xl border-2 bg-gradient-to-br p-5 shadow-sm">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.12),transparent_55%)]"
        aria-hidden
      />
      <div className="relative space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ring-primary/30 inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold tracking-wide text-blue-800 ring-2 dark:text-blue-200">
              <span
                className="bg-primary inline-block size-2 animate-pulse rounded-full"
                aria-hidden
              />
              LIVE
            </span>
            <span className="text-muted-foreground text-sm">
              Ends {new Date(contestEndAtIso).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-background/60 rounded-lg border border-blue-500/20 p-4 backdrop-blur-sm">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Time remaining
            </p>
            <p className="text-foreground mt-1 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
              {formatRemaining(remaining)}
            </p>
          </div>
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 dark:bg-amber-500/10">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Prize pool (planned)
            </p>
            <p className="text-foreground mt-1 text-3xl font-bold tracking-tight text-amber-900 tabular-nums sm:text-4xl dark:text-amber-100">
              {plannedPayoutSats.toLocaleString()}{" "}
              <span className="text-lg font-semibold">sats</span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {winnerCount} winner slot{winnerCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {intro ? (
          <p className="text-foreground text-sm leading-relaxed font-medium">
            {intro}
          </p>
        ) : null}

        <dl className="border-border grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{contestCopy.statsStrip}</dt>
            <dd className="font-semibold">{rankingMetric}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Winner slots</dt>
            <dd className="font-semibold">{winnerCount}</dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="text-muted-foreground">Entries so far</dt>
            <dd className="font-semibold">{totalEntries}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
