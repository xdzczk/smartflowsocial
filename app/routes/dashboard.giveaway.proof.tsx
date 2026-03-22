import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useCallback } from "react";
import { toast } from "react-hot-toast";

import { Button } from "~/components/ui/button";
import { requireUserId } from "~/features/auth";
import type { GiveawayWinnerEntry } from "~/features/giveaway";
import { listGiveawaysByUser } from "~/features/giveaway/giveaway-actions.server";
import {
  formatScopeSummaryLabel,
  formatStatusLabel,
  resolveGiveawayQueueName,
} from "~/features/giveaway/giveaway-display.server";
import { budgetSatsFromGiveawayRow } from "~/features/giveaway/giveaway-payout.server";
import {
  buildGiveawayFairnessProofLines,
  buildGiveawayPublicSummaryLines,
} from "~/features/giveaway/giveaway-proof-share.server";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";

function giveawayProofTitle(
  name: string | null | undefined,
  id: string
): string {
  const trimmed = name?.trim();
  if (trimmed === undefined || trimmed === "") {
    return `Giveaway ${id.slice(0, 8)}`;
  }
  return trimmed;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "giveaways");

  const paid = await listGiveawaysByUser(userId, { status: "PAID_OUT" });
  const rows = await Promise.all(
    paid.map(async (g) => {
      const ref = g.scopeReference as Record<string, unknown>;
      const hasQueue =
        g.scopeType === "QUEUE" ||
        (typeof ref["queueId"] === "string" && ref["queueId"].trim() !== "");
      const queueName = hasQueue
        ? await resolveGiveawayQueueName(userId, ref)
        : null;
      const scopeSummaryLabel = formatScopeSummaryLabel(
        g.scopeType,
        ref,
        queueName
      );
      const snapshot = g.winnerSnapshot as GiveawayWinnerEntry[] | null;
      const winnerCount = snapshot?.length ?? g.winnerCount;
      const budgetSats = budgetSatsFromGiveawayRow(g);
      const meta = g.lastPreviewMeta as { eligiblePoolSize?: number } | null;
      return {
        id: g.id,
        name: g.name ?? null,
        scopeSummaryLabel,
        statusLabel: formatStatusLabel(g.status),
        winnerCount,
        budgetSats,
        completedAt: g.updatedAt.toISOString(),
        selectionMode: g.selectionMode,
        eligiblePoolSize: meta?.eligiblePoolSize,
      };
    })
  );

  return json({ giveaways: rows });
}

export default function GiveawayProofPage() {
  const { giveaways } = useLoaderData<typeof loader>();

  const copySummary = useCallback((g: (typeof giveaways)[number]) => {
    void (async () => {
      const lines = buildGiveawayPublicSummaryLines({
        title: giveawayProofTitle(g.name, g.id),
        scopeLine: g.scopeSummaryLabel,
        winnerCount: g.winnerCount,
        budgetSats: g.budgetSats,
        completedAtLabel: new Date(g.completedAt).toLocaleString(),
      });
      try {
        await navigator.clipboard.writeText(lines.join("\n"));
        toast.success("Public summary copied");
      } catch {
        toast.error("Copy failed");
      }
    })();
  }, []);

  const copyFairness = useCallback((g: (typeof giveaways)[number]) => {
    void (async () => {
      const lines = buildGiveawayFairnessProofLines({
        title: giveawayProofTitle(g.name, g.id),
        eligiblePoolSize: g.eligiblePoolSize,
        selectionModeLabel:
          g.selectionMode === "WEIGHTED_BY_ENGAGEMENT"
            ? "Weighted by engagement"
            : "Unique user",
        lockedOrCompletedAt: new Date(g.completedAt).toLocaleString(),
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
          Copy shareable text for completed giveaways — public summary and
          fairness highlights. (Image cards can be added later.)
        </p>
      </div>

      {giveaways.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No paid-out giveaways yet. Complete one from the detail page, then
          return here.
        </p>
      ) : (
        <ul className="space-y-4">
          {giveaways.map((g) => (
            <li
              key={g.id}
              className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-foreground font-medium">
                  {giveawayProofTitle(g.name, g.id)}
                </p>
                <p className="text-muted-foreground text-sm">
                  {g.scopeSummaryLabel} · {g.winnerCount} winners ·{" "}
                  {g.budgetSats.toLocaleString()} sats · {g.statusLabel}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    copySummary(g);
                  }}
                >
                  Copy public summary
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    copyFairness(g);
                  }}
                >
                  Copy fairness proof
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <Link to={`/dashboard/giveaway/detail/${g.id}`}>Open</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground text-sm">
        <Link to="/dashboard/giveaway" className="text-primary hover:underline">
          ← All giveaways
        </Link>
      </p>
    </div>
  );
}
