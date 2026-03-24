import type { SerializeFrom } from "@remix-run/node";
import { Form, Link, useRouteLoaderData } from "@remix-run/react";
import { useMemo } from "react";

import { CampaignReceiptProofShell } from "~/features/campaign-ui";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";

import { contestCopy } from "../contest-copy";
import type {
  ContestLeaderboardEntryRow,
  ContestLivePreviewRow,
  ContestProfileMap,
  ContestWinnerRow,
} from "../contest-detail-ui.types";
import type { ContestDetailPageData } from "../contest-detail.types";

import { ContestActivityLog } from "./ContestActivityLog";
import { ContestFairnessSnapshotCard } from "./ContestFairnessSnapshotCard";
import { ContestLeaderboard } from "./ContestLeaderboard";
import { ContestLiveHeader } from "./ContestLiveHeader";
import {
  ContestPayoutOverview,
  ContestPayoutWinnerRow,
} from "./ContestPayoutOverview";
import { ContestShareActions } from "./ContestShareActions";
import { ContestSourcePostCard } from "./ContestSourcePostCard";
import { ContestStateBanner } from "./ContestStateBanner";
import { ContestStatsStrip } from "./ContestStatsStrip";

function rootUserFromData(
  data: unknown
): Parameters<typeof getNostrClientUrlsFromUser>[0] {
  if (!data || typeof data !== "object") return null;
  const u = (data as { user?: unknown }).user;
  if (!u || typeof u !== "object") return null;
  return u as {
    preferredNostrClient?: string | null;
    customNostrClientBaseUrl?: string | null;
  };
}

export function ContestDetailView({
  data,
}: {
  data: SerializeFrom<ContestDetailPageData>;
}) {
  const root = useRouteLoaderData("root");
  const nostr = useMemo(
    () => getNostrClientUrlsFromUser(rootUserFromData(root)),
    [root]
  );

  const { contest } = data;
  const isCancelled = contest.status === "CANCELLED";
  const isDraft = contest.status === "DRAFT";
  const isLive = contest.status === "LIVE";
  const isReview = contest.status === "ENDED_REVIEW";
  const isLocked =
    contest.status === "LOCKED" || contest.status === "PAYOUT_IN_PROGRESS";
  const isCompleted = contest.status === "COMPLETED";

  const profiles = data.profiles as ContestProfileMap;
  const winners = data.winners as ContestWinnerRow[];

  const alternatesCount = winners.filter((w) => w.isAlternate).length;

  const excludedList = data.leaderboardExcluded;
  const excludedByReason = useMemo(() => {
    const groups = new Map<string, typeof excludedList>();
    for (const e of excludedList) {
      const key = e.exclusionReason?.trim() ?? "Unspecified";
      const g = groups.get(key) ?? [];
      g.push(e);
      groups.set(key, g);
    }
    return [...groups.entries()];
  }, [excludedList]);

  const frozenRows: ContestLeaderboardEntryRow[] = data.leaderboardEligible.map(
    (r) => ({
      rank: r.rank,
      score: r.score,
      authorPubkey: r.authorPubkey,
      entryEventId: r.entryEventId,
      replySnippet: r.replySnippet,
      createdAtUnix: r.createdAtUnix,
      reactionsCount: r.reactionsCount,
      zapCount: r.zapCount,
      satsZapped: r.satsZapped,
    })
  );

  const liveRows: ContestLivePreviewRow[] = data.livePreview;

  const metric = contest.rankingMetric as "REACTIONS" | "ZAPS" | "SATS_ZAPPED";

  const announcementText = useMemo(
    () =>
      `${contest.title}: ranked by ${metric.toLowerCase()}. Ends ${new Date(contest.contestEndAt).toLocaleString()}.`,
    [contest.title, contest.contestEndAt, metric]
  );
  const updateText = useMemo(
    () =>
      `Contest update: ${data.liveStats?.totalEntries ?? frozenRows.length} entries. ${contestCopy.openSourcePost}.`,
    [data.liveStats?.totalEntries, frozenRows.length]
  );

  const openSource = () => {
    if (contest.sourceNoteId && nostr.eventUrl(contest.sourceNoteId)) {
      window.open(nostr.eventUrl(contest.sourceNoteId), "_blank");
    }
  };

  const feePct =
    data.quote.feeRateBps > 0
      ? `${(data.quote.feeRateBps / 100).toFixed(1)}%`
      : "0%";
  const feeLabel = `Finalization fee (${feePct} on plan ${contest.planLabel})`;

  if (isCancelled) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{contest.title}</h1>
          <p className="text-muted-foreground text-sm">
            {contest.statusLabel} · {metric.toLowerCase()}
          </p>
        </div>
        <ContestStateBanner status={contest.status} />
        <Link
          to="/dashboard/contests"
          className="text-muted-foreground inline-block text-sm hover:underline"
        >
          {contestCopy.backToContests}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{contest.title}</h1>
          <p className="text-muted-foreground text-sm">
            {contest.statusLabel} · {metric.toLowerCase()} · Ends{" "}
            {new Date(contest.contestEndAt).toLocaleString()}
          </p>
        </div>

        <ContestStateBanner status={contest.status} />

        {data.sourcePost?.nostrEventId ? (
          <ContestSourcePostCard
            caption={data.sourcePost.caption}
            fileUrl={data.sourcePost.fileUrl}
            publishedAt={data.sourcePost.publishedAt}
            nostrEventId={data.sourcePost.nostrEventId}
            onOpenNostr={openSource}
          />
        ) : (
          <div className="border-border bg-muted/30 rounded-lg border p-4 text-sm">
            <p className="text-muted-foreground font-mono text-xs">
              Source note: {contest.sourceNoteId}
            </p>
          </div>
        )}

        {isLive && data.liveStats ? (
          <>
            <ContestLiveHeader
              contestEndAtIso={contest.contestEndAt}
              rankingMetric={metric}
              winnerCount={contest.winnerCount}
              plannedPayoutSats={data.quote.plannedPayoutSats}
              totalEntries={data.liveStats.totalEntries}
            />
            <ContestStatsStrip
              metric={metric}
              totalEntries={data.liveStats.totalEntries}
              uniqueParticipants={data.liveStats.uniqueParticipants}
              leadingScore={data.liveStats.leadingScore}
              aggregates={data.aggregates}
            />
            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                {contestCopy.shareActions}
              </p>
              <ContestShareActions
                announcementText={announcementText}
                updateText={updateText}
              />
            </div>
            <ContestLeaderboard
              metric={metric}
              winnerCount={contest.winnerCount}
              profiles={profiles}
              winners={winners}
              rows={liveRows}
              mode="live"
            />
          </>
        ) : null}

        {!isLive &&
        (frozenRows.length > 0 || isReview || isLocked || isCompleted) ? (
          <>
            <ContestStatsStrip
              metric={metric}
              totalEntries={frozenRows.length}
              uniqueParticipants={
                new Set(frozenRows.map((r) => r.authorPubkey)).size
              }
              leadingScore={frozenRows[0]?.score ?? 0}
              aggregates={data.aggregates}
            />
            <ContestLeaderboard
              metric={metric}
              winnerCount={contest.winnerCount}
              profiles={profiles}
              winners={winners}
              rows={frozenRows}
              mode="frozen"
            />
          </>
        ) : null}

        {excludedByReason.length > 0 ? (
          <div className="border-border bg-card rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-semibold">
              {contestCopy.excludedSection}
            </h2>
            <div className="space-y-4">
              {excludedByReason.map(([reason, rows]) => (
                <div key={reason}>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">
                    {reason}
                  </p>
                  <ul className="text-muted-foreground space-y-1 text-sm">
                    {rows.map((e) => (
                      <li key={e.entryEventId}>
                        {e.authorPubkey.slice(0, 12)}… · score {e.score}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isReview || isLocked || isCompleted ? (
          <ContestFairnessSnapshotCard
            snapshot={data.snapshot}
            tieBreakRule={contest.tieBreakRule}
            entryType={contest.entryType}
            fairnessConfig={contest.fairnessConfig}
            alternatesCount={alternatesCount}
          />
        ) : null}

        <ContestActivityLog events={data.eventLogs} />

        {isDraft ? (
          <Form method="post">
            <input type="hidden" name="intent" value="launch" />
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
            >
              {contestCopy.launchContest}
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
              {contestCopy.freezeLeaderboard}
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
            <p className="text-muted-foreground text-xs">
              {feeLabel} · Planned{" "}
              {data.quote.plannedPayoutSats.toLocaleString()} sats · Fee{" "}
              {data.quote.feeSats.toLocaleString()} sats
            </p>
            <button
              type="submit"
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
            >
              {contestCopy.lockWinners}
            </button>
          </Form>
        ) : null}

        {isLocked || isCompleted ? (
          <Form method="post" className="flex flex-wrap gap-2">
            <input type="hidden" name="intent" value="exportCsv" />
            <button
              type="submit"
              className="border-border bg-background rounded-md border px-3 py-1.5 text-sm"
            >
              {contestCopy.proofExport}
            </button>
          </Form>
        ) : null}

        {isLocked ? (
          <div className="space-y-4">
            <ContestPayoutOverview
              summary={data.payoutSummary}
              feeLabel={feeLabel}
            />
            {winners
              .filter((w) => !w.isAlternate)
              .map((winner) => (
                <ContestPayoutWinnerRow
                  key={winner.id}
                  winner={winner}
                  profile={profiles[winner.authorPubkey]}
                  payoutStatus={winner.payoutStatus}
                />
              ))}
            <Form
              method="post"
              className="space-y-2"
              onSubmit={(e) => {
                if (
                  data.payoutSummary.pending > 0 &&
                  !window.confirm(contestCopy.completeWithPendingConfirm)
                ) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="intent" value="complete" />
              <textarea
                name="completeOverrideReason"
                className="border-border bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Override reason if completing with pending payouts"
              />
              <button
                type="submit"
                className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
              >
                {contestCopy.markContestComplete}
              </button>
            </Form>
          </div>
        ) : null}

        {isCompleted ? (
          <CampaignReceiptProofShell
            receiptTitle={contestCopy.receipt}
            receiptBody={<p className="text-sm">{data.receiptSummaryLine}</p>}
            proofTitle={contestCopy.publicProof}
            proofBody={
              <pre className="text-muted-foreground overflow-x-auto text-xs whitespace-pre-wrap">
                {data.publicSummaryText}
              </pre>
            }
            actions={
              <>
                {data.winnerAnnouncementText ? (
                  <button
                    type="button"
                    className="border-border bg-background rounded-md border px-3 py-1.5 text-sm"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        data.winnerAnnouncementText ?? ""
                      )
                    }
                  >
                    {contestCopy.copyWinnerAnnouncement}
                  </button>
                ) : null}
                {data.publicSummaryText ? (
                  <button
                    type="button"
                    className="border-border bg-background rounded-md border px-3 py-1.5 text-sm"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        data.publicSummaryText ?? ""
                      )
                    }
                  >
                    {contestCopy.copyPublicSummary}
                  </button>
                ) : null}
                {data.fairnessProofText ? (
                  <button
                    type="button"
                    className="border-border bg-background rounded-md border px-3 py-1.5 text-sm"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        data.fairnessProofText ?? ""
                      )
                    }
                  >
                    {contestCopy.copyFairnessProofJson}
                  </button>
                ) : null}
              </>
            }
          />
        ) : null}

        {isDraft || isLive || isReview ? (
          <Form method="post" className="pt-2">
            <input type="hidden" name="intent" value="cancel" />
            <input type="hidden" name="reason" value="Cancelled by creator" />
            <button
              type="submit"
              className="text-destructive text-sm hover:underline"
            >
              {contestCopy.cancelContest}
            </button>
          </Form>
        ) : null}

        <Link
          to="/dashboard/contests"
          className="text-muted-foreground inline-block text-sm hover:underline"
        >
          {contestCopy.backToContests}
        </Link>
      </div>
    </div>
  );
}
