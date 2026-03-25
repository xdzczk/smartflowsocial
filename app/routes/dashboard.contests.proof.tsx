import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useCallback } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import { requireUserId } from "~/features/auth";
import {
  buildContestFairnessProofLines,
  buildContestPublicSummaryLines,
  formatContestStatusLabel,
  listContestsFiltered,
} from "~/features/contest";
import type { Contest } from "~/features/contest/data/contest-prisma-types.server";
import { findLatestContestSnapshot } from "~/features/contest/repositories/contest-detail-queries.server";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments";
import { featureFlags } from "~/lib/feature-flags.server";

function contestProofTitle(
  name: string | null | undefined,
  id: string
): string {
  const trimmed = name?.trim();
  if (trimmed === undefined || trimmed === "") {
    return `Contest ${id.slice(0, 8)}`;
  }
  return trimmed;
}

function contestDurationLabel(contest: Contest): string {
  const start = contest.contestStartAt ?? contest.createdAt;
  const ms = contest.contestEndAt.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "the contest window";
  const h = Math.round(ms / 3600000);
  if (h < 48) return `${Math.max(1, h)} hour(s)`;
  const d = Math.round(h / 24);
  return `${d} day(s)`;
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");

  const completed = await listContestsFiltered(userId, {
    status: "COMPLETED",
    sort: "completed",
  });

  const rows = await Promise.all(
    completed.map(async (c) => {
      const snap = await findLatestContestSnapshot(c.id);
      const title = contestProofTitle(c.title, c.id);
      const completedAt = c.completedAt ?? c.updatedAt;
      const completedAtLabel = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(completedAt);
      return {
        id: c.id,
        title,
        rankingMetric: c.rankingMetric,
        winnerCount: c.winnerCount,
        plannedPayoutSats: c.plannedPayoutSats ?? 0,
        statusLabel: formatContestStatusLabel("COMPLETED"),
        completedAtLabel,
        durationLabel: contestDurationLabel(c),
        tieBreakRule: c.tieBreakRule,
        entryType: c.entryType,
        eligibleEntries: snap?.eligibleEntries ?? null,
        lockedOrCompletedAt: completedAtLabel,
      };
    })
  );

  return json({ contests: rows });
}

export default function ContestProofPage() {
  const { contests } = useLoaderData<typeof loader>();

  const copySummary = useCallback((c: (typeof contests)[number]) => {
    void (async () => {
      const lines = buildContestPublicSummaryLines({
        title: c.title,
        rankingMetric: c.rankingMetric,
        winnerCount: c.winnerCount,
        plannedPayoutSats: c.plannedPayoutSats,
        durationLabel: c.durationLabel,
        completedAtLabel: c.completedAtLabel,
      });
      try {
        await navigator.clipboard.writeText(lines.join("\n"));
        toast.success("Public summary copied");
      } catch {
        toast.error("Copy failed");
      }
    })();
  }, []);

  const copyFairness = useCallback((c: (typeof contests)[number]) => {
    void (async () => {
      const lines = buildContestFairnessProofLines({
        title: c.title,
        eligibleEntries: c.eligibleEntries,
        tieBreakRule: c.tieBreakRule,
        entryType: c.entryType,
        lockedOrCompletedAt: c.lockedOrCompletedAt,
      });
      try {
        await navigator.clipboard.writeText(lines.join("\n"));
        toast.success("Fairness proof copied");
      } catch {
        toast.error("Copy failed");
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold">Proof cards</h1>
        <p className="text-muted-foreground mt-1 max-w-xl text-sm">
          Copy shareable text for completed contests — public summary and
          fairness highlights.
        </p>
      </div>

      {contests.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No completed contests yet. Mark a contest complete from its detail
          page, then return here.
        </p>
      ) : (
        <ul className="space-y-4">
          {contests.map((c) => (
            <li
              key={c.id}
              className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-foreground font-medium">{c.title}</p>
                <p className="text-muted-foreground text-sm">
                  {c.rankingMetric.toLowerCase()} · {c.winnerCount} winners ·{" "}
                  {c.plannedPayoutSats.toLocaleString()} sats · {c.statusLabel}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    copySummary(c);
                  }}
                >
                  Copy public summary
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    copyFairness(c);
                  }}
                >
                  Copy fairness proof
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link to={`/dashboard/contests/detail/${c.id}`}>Open</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-sm">
        <Link to="/dashboard/contests" className="text-primary hover:underline">
          ← All contests
        </Link>
      </p>
    </div>
  );
}
