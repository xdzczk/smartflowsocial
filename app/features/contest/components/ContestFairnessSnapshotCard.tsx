import { contestCopy } from "../contest-copy";

export function ContestFairnessSnapshotCard({
  snapshot,
  tieBreakRule,
  entryType,
  fairnessConfig,
  alternatesCount,
}: {
  snapshot: {
    snapshotAt: string;
    totalEntries: number;
    eligibleEntries: number;
    excludedEntries: number;
    rankingMetric: string;
    tieBreakRule: string;
  } | null;
  tieBreakRule: string | null;
  entryType: string;
  fairnessConfig: Record<string, unknown> | null;
  alternatesCount: number;
}) {
  const filters = fairnessConfig ?? {};
  const excludeMuted = Boolean(filters["excludeMuted"]);
  const excludeBlocked = Boolean(filters["excludeBlocked"]);
  const excludeLowTrust = Boolean(filters["excludeLowTrust"]);
  const excludeNonFollowers = Boolean(filters["excludeNonFollowers"]);
  const minAge =
    typeof filters["minAccountAgeDays"] === "number"
      ? filters["minAccountAgeDays"]
      : null;
  const minFollowers =
    typeof filters["minFollowers"] === "number"
      ? filters["minFollowers"]
      : null;
  const hasAnyFilter =
    excludeMuted ||
    excludeBlocked ||
    excludeLowTrust ||
    excludeNonFollowers ||
    (minAge != null && minAge > 0) ||
    (minFollowers != null && minFollowers > 0);
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold">{contestCopy.fairnessCard}</h2>
      {snapshot ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Snapshot frozen</dt>
            <dd>{new Date(snapshot.snapshotAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Eligible entries</dt>
            <dd>{snapshot.eligibleEntries}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Excluded entries</dt>
            <dd>{snapshot.excludedEntries}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ranking metric</dt>
            <dd>{snapshot.rankingMetric}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Tie-break</dt>
            <dd className="font-mono text-xs">
              {snapshot.tieBreakRule.trim() !== ""
                ? snapshot.tieBreakRule
                : (tieBreakRule ?? "—")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Entry scope</dt>
            <dd>
              {entryType === "REPLY_DIRECT" ? "Direct replies only" : entryType}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Alternates</dt>
            <dd>{alternatesCount}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground text-sm">No snapshot yet.</p>
      )}
      <div className="mt-3 border-t pt-3">
        <p className="text-muted-foreground mb-1 text-xs font-medium">
          Fairness filters
        </p>
        <ul className="text-muted-foreground list-inside list-disc text-xs">
          {!hasAnyFilter ? <li>None (all filters off)</li> : null}
          {excludeMuted ? <li>Exclude muted</li> : null}
          {excludeBlocked ? <li>Exclude blocked</li> : null}
          {excludeLowTrust ? <li>Exclude low trust</li> : null}
          {excludeNonFollowers ? <li>Exclude non-followers</li> : null}
          {minAge != null && minAge > 0 ? (
            <li>Min account age: {minAge} days</li>
          ) : null}
          {minFollowers != null && minFollowers > 0 ? (
            <li>Min followers: {minFollowers}</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
