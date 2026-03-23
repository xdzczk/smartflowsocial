/* eslint-disable no-restricted-imports -- Contest detail page is a v1 route scaffold and will be refactored to shared data APIs. */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  cancelContest,
  completeContest,
  freezeContestAtDeadline,
  getContestById,
  launchContest,
  lockContest,
  setContestWinnerPayoutStatus,
} from "~/features/contest";
import {
  buildContestPublicSummaryLines,
  buildContestReceiptSummaryLine,
} from "~/features/contest/contest-proof-share.server";
import { formatContestStatusLabel } from "~/features/contest/contest-status-ui";
import {
  requireAnySubscription,
  requireFeatureAccess,
} from "~/features/payments";
import { featureFlags } from "~/lib/feature-flags.server";
import { prisma } from "~/lib/prisma.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");
  const id = params["id"];
  if (!id) throw new Response("Not found", { status: 404 });

  const contest = await getContestById(id, userId);
  if (!contest) throw new Response("Not found", { status: 404 });

  const winners = await prisma.contestWinner.findMany({
    where: { contestId: id },
    include: { entry: true },
    orderBy: [{ isAlternate: "asc" }, { rank: "asc" }],
  });

  const leaderboard = await prisma.contestEntry.findMany({
    where: { contestId: id, isExcluded: false },
    orderBy: [{ rank: "asc" }, { score: "desc" }],
    take: 50,
  });

  const completedAtLabel = contest.completedAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(contest.completedAt)
    : null;

  return json({
    contest: {
      id: contest.id,
      title: contest.title ?? `Contest ${contest.id.slice(0, 8)}`,
      sourceNoteId: contest.sourceNoteId,
      status: contest.status,
      statusLabel: formatContestStatusLabel(contest.status),
      rankingMetric: contest.rankingMetric,
      contestEndAt: contest.contestEndAt.toISOString(),
      winnerCount: contest.winnerCount,
      prizeMode: contest.prizeMode,
      plannedPayoutSats: contest.plannedPayoutSats ?? 0,
      finalizationFeeSats: contest.finalizationFeeSats ?? 0,
      finalizationFeeStatus: contest.finalizationFeeStatus ?? null,
      freezeSnapshotAt: contest.freezeSnapshotAt?.toISOString() ?? null,
      lockConfigHash: contest.lockConfigHash ?? null,
      payoutState: contest.payoutState,
    },
    winners: winners.map((w) => ({
      id: w.id,
      rank: w.rank,
      rewardSats: w.rewardSats,
      isAlternate: w.isAlternate,
      score: w.entry.score,
      authorPubkey: w.entry.authorPubkey,
      entryEventId: w.entry.entryEventId,
      replySnippet: w.entry.replySnippet,
    })),
    leaderboard: leaderboard.map((row) => ({
      rank: row.rank,
      score: row.score,
      authorPubkey: row.authorPubkey,
      entryEventId: row.entryEventId,
      replySnippet: row.replySnippet,
    })),
    receiptSummaryLine:
      contest.status === "COMPLETED" && completedAtLabel
        ? buildContestReceiptSummaryLine({
            sourceNoteId: contest.sourceNoteId,
            rankingMetric: contest.rankingMetric,
            winnerCount: contest.winnerCount,
            plannedPayoutSats: contest.plannedPayoutSats ?? 0,
            finalizationFeeSats: contest.finalizationFeeSats ?? 0,
            completedAtLabel,
          })
        : null,
    publicSummaryText:
      contest.status === "COMPLETED"
        ? buildContestPublicSummaryLines({
            title: contest.title ?? `Contest ${contest.id.slice(0, 8)}`,
            rankingMetric: contest.rankingMetric,
            winnerCount: contest.winnerCount,
            plannedPayoutSats: contest.plannedPayoutSats ?? 0,
            durationLabel: "configured duration",
          }).join("\n")
        : null,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!featureFlags.contestsV1Enabled) {
    throw new Response("Not found", { status: 404 });
  }
  const userId = await requireUserId(request);
  await requireAnySubscription(userId);
  await requireFeatureAccess(userId, "contests");
  const id = params["id"];
  if (!id) return json({ error: "Not found" }, { status: 404 });
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "launch") {
    const result = await launchContest(userId, id);
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect(`/dashboard/contests/detail/${id}`);
  }
  if (intent === "freeze") {
    const result = await freezeContestAtDeadline(userId, id);
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect(`/dashboard/contests/detail/${id}`);
  }
  if (intent === "lock") {
    const result = await lockContest(userId, id, {
      lockConfigHash: String(formData.get("lockConfigHash") ?? ""),
    });
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect(`/dashboard/contests/detail/${id}`);
  }
  if (intent === "payout") {
    const winnerPubkey = String(formData.get("winnerPubkey") ?? "");
    const payoutStatus = String(formData.get("payoutStatus") ?? "pending") as
      | "pending"
      | "sent"
      | "failed"
      | "marked_paid";
    const result = await setContestWinnerPayoutStatus(
      userId,
      id,
      winnerPubkey,
      payoutStatus
    );
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect(`/dashboard/contests/detail/${id}`);
  }
  if (intent === "complete") {
    const result = await completeContest(userId, id, {
      completeOverrideReason: String(
        formData.get("completeOverrideReason") ?? ""
      ),
    });
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect(`/dashboard/contests/detail/${id}`);
  }
  if (intent === "cancel") {
    const result = await cancelContest(
      userId,
      id,
      String(formData.get("reason") ?? "")
    );
    if (!result.success) return json({ error: result.error }, { status: 400 });
    return redirect("/dashboard/contests");
  }
  return json({ error: "Unknown intent" }, { status: 400 });
}

export default function ContestDetailRoute() {
  const {
    contest,
    winners,
    leaderboard,
    receiptSummaryLine,
    publicSummaryText,
  } = useLoaderData<typeof loader>();

  const isDraft = contest.status === "DRAFT";
  const isLive = contest.status === "LIVE";
  const isReview = contest.status === "ENDED_REVIEW";
  const isLocked =
    contest.status === "LOCKED" || contest.status === "PAYOUT_IN_PROGRESS";
  const isCompleted = contest.status === "COMPLETED";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{contest.title}</h1>
        <p className="text-muted-foreground text-sm">
          {contest.statusLabel} · Metric: {contest.rankingMetric.toLowerCase()}{" "}
          · Ends {new Date(contest.contestEndAt).toLocaleString()}
        </p>
      </div>

      <div className="border-border bg-card rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-semibold">Rules</h2>
        <p className="text-muted-foreground text-sm">
          Entry type: Direct replies to source note.
        </p>
        <p className="text-muted-foreground text-sm">
          Ties: earliest qualifying reply, then deterministic event id fallback.
        </p>
        <p className="text-muted-foreground text-sm">
          Source note: {contest.sourceNoteId}
        </p>
      </div>

      {isDraft ? (
        <Form method="post">
          <input type="hidden" name="intent" value="launch" />
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            Launch contest
          </button>
        </Form>
      ) : null}

      {isLive ? (
        <Form method="post">
          <input type="hidden" name="intent" value="freeze" />
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            Freeze leaderboard (ended review)
          </button>
        </Form>
      ) : null}

      {isReview ? (
        <Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="lock" />
          <input
            type="hidden"
            name="lockConfigHash"
            value={contest.lockConfigHash ?? ""}
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            Lock winners
          </button>
          <p className="text-muted-foreground text-xs">
            Leaderboard frozen at{" "}
            {contest.freezeSnapshotAt
              ? new Date(contest.freezeSnapshotAt).toLocaleString()
              : "n/a"}
            .
          </p>
        </Form>
      ) : null}

      <div className="border-border bg-card rounded-lg border">
        <div className="border-border border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Leaderboard</h2>
        </div>
        <div className="divide-border divide-y">
          {leaderboard.length === 0 ? (
            <p className="text-muted-foreground px-4 py-4 text-sm">
              No entries yet.
            </p>
          ) : (
            leaderboard.map((row) => (
              <div
                key={row.entryEventId}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    #{row.rank ?? "-"} · {row.authorPubkey.slice(0, 12)}...
                  </p>
                  <p className="text-muted-foreground truncate">
                    {row.replySnippet ?? "(no text snippet)"}
                  </p>
                </div>
                <p className="font-medium">{row.score}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {isLocked ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Payouts</h2>
          {winners
            .filter((w) => !w.isAlternate)
            .map((winner) => (
              <Form
                method="post"
                key={winner.id}
                className="border-border bg-card grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium">
                    #{winner.rank} · {winner.authorPubkey.slice(0, 12)}...
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {winner.rewardSats.toLocaleString()} sats
                  </p>
                </div>
                <input type="hidden" name="intent" value="payout" />
                <input
                  type="hidden"
                  name="winnerPubkey"
                  value={winner.authorPubkey}
                />
                <select
                  name="payoutStatus"
                  className="border-border bg-background rounded-md border px-3 py-2 text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="marked_paid">Marked paid</option>
                </select>
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm"
                >
                  Update
                </button>
              </Form>
            ))}
          <Form method="post" className="space-y-2">
            <input type="hidden" name="intent" value="complete" />
            <textarea
              name="completeOverrideReason"
              className="border-border bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Optional override reason if payouts are still pending"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
            >
              Mark contest complete
            </button>
          </Form>
        </div>
      ) : null}

      {isCompleted ? (
        <div className="space-y-3">
          <div className="border-border bg-card rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-semibold">Receipt</h2>
            <p className="text-sm">{receiptSummaryLine}</p>
          </div>
          <div className="border-border bg-card rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-semibold">Public summary proof</h2>
            <pre className="text-muted-foreground overflow-x-auto text-xs whitespace-pre-wrap">
              {publicSummaryText}
            </pre>
          </div>
        </div>
      ) : null}

      {isDraft || isLive || isReview ? (
        <Form method="post" className="pt-2">
          <input type="hidden" name="intent" value="cancel" />
          <input type="hidden" name="reason" value="Cancelled by creator" />
          <button
            type="submit"
            className="text-destructive text-sm hover:underline"
          >
            Cancel contest
          </button>
        </Form>
      ) : null}

      <Link
        to="/dashboard/contests"
        className="text-muted-foreground inline-block text-sm hover:underline"
      >
        Back to contests
      </Link>
    </div>
  );
}
/* eslint-enable no-restricted-imports */
