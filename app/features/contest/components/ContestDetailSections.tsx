import type { SerializeFrom } from "@remix-run/node";
import { Form, Link } from "@remix-run/react";

import { CampaignReceiptProofShell } from "~/features/campaign-ui";
import type { NostrClientUrls } from "~/lib/nostr-client-urls";

import { contestCopy } from "../contest-copy";
import type {
  ContestLeaderboardEntryRow,
  ContestLivePreviewRow,
  ContestProfileMap,
  ContestWinnerRow,
} from "../contest-detail-ui.types";
import type { ContestDetailPageData } from "../contest-detail.types";

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

type DetailData = SerializeFrom<ContestDetailPageData>;
type ContestRow = DetailData["contest"];
export type ContestDetailNostrUrls = NostrClientUrls;

export function ContestDetailCancelledLayout({
  contest,
  metric,
}: {
  contest: ContestRow;
  metric: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard/contests"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to Contests
        </Link>
      </div>
      <div className="border-border bg-card rounded-lg border p-5">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {contest.title}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {contest.statusLabel} · {metric.toLowerCase()}
        </p>
      </div>
      <ContestStateBanner status={contest.status} />
    </div>
  );
}

export function ContestDetailBackLink() {
  return (
    <div className="flex items-center gap-4">
      <Link
        to="/dashboard/contests"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Back to Contests
      </Link>
    </div>
  );
}

export function ContestDetailHeroHeader({
  contest,
  metric,
  headerToneClass,
  stateSummary,
  statusTimestamp,
}: {
  contest: ContestRow;
  metric: string;
  headerToneClass: string;
  stateSummary: string;
  statusTimestamp: string;
}) {
  return (
    <div className={`rounded-lg border p-5 ${headerToneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {contest.title}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">{stateSummary}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right text-xs">
          <span className="bg-muted text-foreground inline-flex rounded-full px-3 py-1 text-xs font-semibold">
            {contest.statusLabel}
          </span>
          <span className="text-muted-foreground">
            Updated {new Date(statusTimestamp).toLocaleString()}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground mt-3 text-sm">
        Ranked by {metric.toLowerCase()} · Ends{" "}
        {new Date(contest.contestEndAt).toLocaleString()}
      </p>
    </div>
  );
}

export function ContestDetailSourceSection({
  sourcePost,
  sourceNoteId,
  onOpenNostr,
}: {
  sourcePost: DetailData["sourcePost"];
  sourceNoteId: string;
  onOpenNostr: () => void;
}) {
  if (sourcePost?.nostrEventId) {
    return (
      <ContestSourcePostCard
        caption={sourcePost.caption}
        fileUrl={sourcePost.fileUrl}
        publishedAt={sourcePost.publishedAt}
        nostrEventId={sourcePost.nostrEventId}
        onOpenNostr={onOpenNostr}
      />
    );
  }
  return (
    <div className="border-border bg-muted/30 rounded-lg border p-4 text-sm">
      <p className="text-muted-foreground font-mono text-xs">
        Source note: {sourceNoteId}
      </p>
    </div>
  );
}

export function ContestDetailLiveSection({
  contest,
  data,
  metric,
  profiles,
  winners,
  liveRows,
  announcementText,
  updateText,
}: {
  contest: ContestRow;
  data: DetailData;
  metric: "REACTIONS" | "ZAPS" | "SATS_ZAPPED";
  profiles: ContestProfileMap;
  winners: ContestWinnerRow[];
  liveRows: ContestLivePreviewRow[];
  announcementText: string;
  updateText: string;
}) {
  if (!data.liveStats) {
    return null;
  }
  return (
    <>
      <div className="border-border bg-card rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="rounded bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-200">
            Live
          </span>
          <span className="text-muted-foreground text-xs">
            Winner slots: {contest.winnerCount}
          </span>
        </div>
        <p className="text-sm font-medium">
          Reply to the source post before the deadline. Winners are ranked by{" "}
          {metric.toLowerCase()}.
        </p>
      </div>
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
      <div className="flex flex-wrap gap-2">
        <Form method="post">
          <input type="hidden" name="intent" value="freeze" />
          <button
            type="submit"
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            {contestCopy.freezeLeaderboard}
          </button>
        </Form>
        <button
          type="button"
          className="border-border bg-background rounded-md border px-4 py-2 text-sm"
          onClick={() => void navigator.clipboard.writeText(updateText)}
        >
          {contestCopy.copyUpdate}
        </button>
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
  );
}

export function ContestDetailFrozenSection({
  showFrozen,
  frozenRows,
  contest,
  metric,
  profiles,
  winners,
  aggregates,
}: {
  showFrozen: boolean;
  frozenRows: ContestLeaderboardEntryRow[];
  contest: ContestRow;
  metric: "REACTIONS" | "ZAPS" | "SATS_ZAPPED";
  profiles: ContestProfileMap;
  winners: ContestWinnerRow[];
  aggregates: DetailData["aggregates"];
}) {
  if (!showFrozen) {
    return null;
  }
  return (
    <>
      <ContestStatsStrip
        metric={metric}
        totalEntries={frozenRows.length}
        uniqueParticipants={new Set(frozenRows.map((r) => r.authorPubkey)).size}
        leadingScore={frozenRows[0]?.score ?? 0}
        aggregates={aggregates}
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
  );
}

export function ContestDetailExcludedSection({
  excludedByReason,
}: {
  excludedByReason: Array<[string, DetailData["leaderboardExcluded"]]>;
}) {
  if (excludedByReason.length === 0) {
    return null;
  }
  return (
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
  );
}

export function ContestDetailFairnessSection({
  showFairness,
  snapshot,
  tieBreakRule,
  entryType,
  fairnessConfig,
  alternatesCount,
}: {
  showFairness: boolean;
  snapshot: DetailData["snapshot"];
  tieBreakRule: string | null;
  entryType: string;
  fairnessConfig: Record<string, unknown> | null;
  alternatesCount: number;
}) {
  if (!showFairness) {
    return null;
  }
  return (
    <ContestFairnessSnapshotCard
      snapshot={snapshot}
      tieBreakRule={tieBreakRule}
      entryType={entryType}
      fairnessConfig={fairnessConfig}
      alternatesCount={alternatesCount}
    />
  );
}

export function ContestDetailFormsSection({
  contest,
  data,
  isDraft,
  isReview,
  isLocked,
  isCompleted,
  feeLabel,
  metric,
  winners,
  nostr,
}: {
  contest: ContestRow;
  data: DetailData;
  isDraft: boolean;
  isReview: boolean;
  isLocked: boolean;
  isCompleted: boolean;
  feeLabel: string;
  metric: "REACTIONS" | "ZAPS" | "SATS_ZAPPED";
  winners: ContestWinnerRow[];
  nostr: ContestDetailNostrUrls;
}) {
  return (
    <>
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

      {isReview ? (
        <Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="lock" />
          <input
            type="hidden"
            name="lockConfigHash"
            value={contest.lockConfigHash ?? ""}
          />
          <p className="text-muted-foreground text-xs">
            {feeLabel} · Planned {data.quote.plannedPayoutSats.toLocaleString()}{" "}
            sats · Fee {data.quote.feeSats.toLocaleString()} sats
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
          <ul className="border-border divide-border divide-y rounded-lg border">
            {winners
              .filter((w) => !w.isAlternate)
              .map((winner) => (
                <ContestPayoutWinnerRow
                  key={winner.id}
                  winner={winner}
                  profile={data.profiles[winner.authorPubkey]}
                  payoutStatus={winner.payoutStatus}
                  getProfileUrl={(npub) => nostr.profileUrl(npub)}
                />
              ))}
          </ul>
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
          receiptBody={
            <div className="space-y-3 text-sm">
              <p>{data.receiptSummaryLine}</p>
              <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd className="font-mono">{contest.sourceNoteId}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Metric</dt>
                  <dd>{metric.toLowerCase()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Winners</dt>
                  <dd>{winners.filter((w) => !w.isAlternate).length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Prize pool</dt>
                  <dd>{data.quote.plannedPayoutSats.toLocaleString()} sats</dd>
                </div>
              </dl>
            </div>
          }
          proofTitle={contestCopy.publicProof}
          proofBody={
            <div className="space-y-3">
              <pre className="text-muted-foreground overflow-x-auto text-xs whitespace-pre-wrap">
                {data.publicSummaryText}
              </pre>
              <div className="space-y-1">
                <p className="text-xs font-medium">Winners</p>
                <ul className="text-muted-foreground space-y-1 text-xs">
                  {winners
                    .filter((w) => !w.isAlternate)
                    .map((winner) => (
                      <li key={winner.id}>
                        #{winner.rank} · {winner.rewardSats.toLocaleString()}{" "}
                        sats · score {winner.score}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
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
    </>
  );
}

export function ContestDetailCancelSection({
  showCancel,
}: {
  showCancel: boolean;
}) {
  if (!showCancel) {
    return null;
  }
  return (
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
  );
}
