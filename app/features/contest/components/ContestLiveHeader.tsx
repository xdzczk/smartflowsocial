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
    <div className="border-brand/25 from-brand/8 via-surface to-surface shadow-1 relative overflow-hidden rounded-xl border-2 bg-gradient-to-br p-5">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--info)_/_0.12),transparent_55%)]"
        aria-hidden
      />
      <div className="relative space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ring-brand/30 bg-info/20 text-info-text dark:text-info inline-cluster-tight.5 rounded-full px-3 py-1 text-xs font-bold tracking-wide ring-2">
              <span
                className="bg-action-primary inline-block size-2 animate-pulse rounded-full"
                aria-hidden
              />
              LIVE
            </span>
            <span className="text-text-secondary text-sm">
              Ends {new Date(contestEndAtIso).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-canvas/60 border-info/20 rounded-lg border p-4 backdrop-blur-sm">
            <p className="text-text-secondary text-overline">Time remaining</p>
            <p className="text-text text-h1 sm:text-display mt-1 tabular-nums">
              {formatRemaining(remaining)}
            </p>
          </div>
          <div className="border-warning/25 bg-warning/5 dark:bg-warning/10 rounded-lg border p-4">
            <p className="text-text-secondary text-overline">
              Prize pool (planned)
            </p>
            <p className="text-text text-h1 sm:text-display text-warning-text dark:text-warning mt-1 tabular-nums">
              {plannedPayoutSats.toLocaleString()}{" "}
              <span className="text-h3">sats</span>
            </p>
            <p className="text-text-secondary text-caption mt-1">
              {winnerCount} winner slot{winnerCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {intro ? (
          <p className="text-text text-sm leading-relaxed font-medium">
            {intro}
          </p>
        ) : null}

        <dl className="border-border grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-text-secondary">{contestCopy.statsStrip}</dt>
            <dd className="font-semibold">{rankingMetric}</dd>
          </div>
          <div>
            <dt className="text-text-secondary">Winner slots</dt>
            <dd className="font-semibold">{winnerCount}</dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="text-text-secondary">Entries so far</dt>
            <dd className="font-semibold">{totalEntries}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
