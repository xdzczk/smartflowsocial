import type { SerializeFrom } from "@remix-run/node";
import { Form, Link, useFetcher } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { Button } from "~/components/ui/button";
import {
  CampaignReceiptProofShell,
  PayoutMethodSelector,
  PayoutProgressCard,
  payoutCopy,
} from "~/features/campaign-ui";
import { type BatchPayoutProgressSnapshot } from "~/features/payments/components/BatchPayoutStatusBanner";
import { BRAND_NAME } from "~/lib/brand";
import type { NostrClientUrls } from "~/lib/nostr-client-urls";

import { contestCopy } from "../contest-copy";
import type {
  ContestLeaderboardEntryRow,
  ContestLivePreviewRow,
  ContestProfileMap,
  ContestWinnerRow,
} from "../contest-detail-ui.types";
import type { ContestDetailPageData } from "../contest-detail.types";
import type { ContestRankingMetric } from "../types";

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

export function ContestPublicShareRow({ contestId }: { contestId: string }) {
  const publicPath = `/contest/${contestId}`;
  return (
    <div className="border-border bg-muted/15 flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm">
      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Public results
      </span>
      <Button variant="outline" size="sm" asChild>
        <a href={publicPath} target="_blank" rel="noreferrer">
          Open public page
        </a>
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          const url =
            typeof window !== "undefined"
              ? `${window.location.origin}${publicPath}`
              : publicPath;
          void navigator.clipboard.writeText(url);
        }}
      >
        Copy public link
      </Button>
    </div>
  );
}

export function ContestDetailHeroHeader({
  contest,
  metric,
  headerToneClass,
  stateSummary,
  statusTimestamp,
  phaseLabel,
}: {
  contest: ContestRow;
  metric: string;
  headerToneClass: string;
  stateSummary: string;
  statusTimestamp: string;
  phaseLabel: string;
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
            {phaseLabel}
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
  sourceNoteId: string | null;
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
      <p className="text-muted-foreground text-xs">
        {sourceNoteId
          ? `Source note: ${sourceNoteId}`
          : "Source note will be set when the entry post is published."}
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
  metric: ContestRankingMetric;
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
    <div className="space-y-5">
      <ContestLiveHeader
        contestEndAtIso={contest.contestEndAt}
        rankingMetric={metric}
        winnerCount={contest.winnerCount}
        plannedPayoutSats={data.quote.plannedPayoutSats}
        totalEntries={data.liveStats.totalEntries}
        intro={`Reply to the source post before the deadline. Winners are ranked by ${metric.toLowerCase()}.`}
      />
      <ContestStatsStrip
        metric={metric}
        totalEntries={data.liveStats.totalEntries}
        uniqueParticipants={data.liveStats.uniqueParticipants}
        leadingScore={data.liveStats.leadingScore}
        aggregates={data.aggregates}
      />
      <div className="border-border bg-muted/15 rounded-lg border p-3">
        <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
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
      </div>
      <ContestLeaderboard
        metric={metric}
        winnerCount={contest.winnerCount}
        profiles={profiles}
        winners={winners}
        rows={liveRows}
        mode="live"
      />
    </div>
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
  metric: ContestRankingMetric;
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
  canUsePresets,
}: {
  contest: ContestRow;
  data: DetailData;
  isDraft: boolean;
  isReview: boolean;
  isLocked: boolean;
  isCompleted: boolean;
  feeLabel: string;
  metric: ContestRankingMetric;
  winners: ContestWinnerRow[];
  nostr: ContestDetailNostrUrls;
  canUsePresets: boolean;
}) {
  const batchPayoutFetcher = useFetcher<{
    success?: boolean;
    error?: string;
    done?: boolean;
    nextStep?: number | null;
    stepIndex?: number;
    totalSteps?: number;
    totals?: {
      items: number;
      paid: number;
      failed: number;
      claimNeeded: number;
      skipped: number;
    };
  }>();
  const isBatchPayoutPending = batchPayoutFetcher.state !== "idle";
  const batchProgressSnapshot: BatchPayoutProgressSnapshot | null =
    batchPayoutFetcher.data &&
    batchPayoutFetcher.data.success === true &&
    batchPayoutFetcher.data.totals &&
    typeof batchPayoutFetcher.data.stepIndex === "number" &&
    typeof batchPayoutFetcher.data.totalSteps === "number"
      ? {
          stepIndex: batchPayoutFetcher.data.stepIndex,
          totalSteps: batchPayoutFetcher.data.totalSteps,
          totals: {
            paid: batchPayoutFetcher.data.totals.paid,
            failed: batchPayoutFetcher.data.totals.failed,
            claimNeeded: batchPayoutFetcher.data.totals.claimNeeded,
            skipped: batchPayoutFetcher.data.totals.skipped,
          },
        }
      : null;

  useEffect(() => {
    if (batchPayoutFetcher.state !== "idle") return;
    const d = batchPayoutFetcher.data;
    if (!d || d.success !== true) return;
    if (d.done !== false || typeof d.nextStep !== "number") return;
    const fd = new FormData();
    fd.set("intent", "runBatchPayout");
    fd.set("stepIndex", String(d.nextStep));
    batchPayoutFetcher.submit(fd, { method: "post" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chained batch steps; deps are state/data only
  }, [batchPayoutFetcher.state, batchPayoutFetcher.data]);

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

      {isDraft && canUsePresets ? (
        <div className="border-border space-y-2 rounded-lg border p-4">
          <p className="text-foreground text-sm font-medium">
            {contestCopy.savePresetSectionTitle}
          </p>
          <p className="text-muted-foreground text-xs">
            {contestCopy.savePresetHint}
          </p>
          <Form method="post" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="intent" value="savePreset" />
            <input
              name="presetName"
              required
              placeholder={contestCopy.presetNamePlaceholder}
              className="border-border bg-background min-w-[200px] flex-1 rounded-md border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="border-border bg-background hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium"
            >
              Save
            </button>
          </Form>
        </div>
      ) : null}

      {isReview ? (
        <Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="lock" />
          <input
            type="hidden"
            name="lockConfigHash"
            value={contest.lockConfigHash ?? ""}
          />
          <p className="text-muted-foreground text-sm">
            Locking makes final placements immutable for payout and proof.
            {BRAND_NAME} does not hold prize funds.
          </p>
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
          <Form
            method="post"
            className="border-border bg-card space-y-3 rounded-lg border p-4"
          >
            <input type="hidden" name="intent" value="updatePayoutSettings" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Payout settings</p>
                <p className="text-muted-foreground text-xs">
                  {payoutCopy.lockTrustNote} Manual payout remains available as
                  fallback.
                </p>
              </div>
              <button
                type="submit"
                className="border-border bg-background hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
              >
                Save
              </button>
            </div>

            <PayoutMethodSelector
              walletMode={contest.payoutWalletMode}
              autoPayEnabled={contest.payoutAutoRunEnabled}
              autoPayCapSats={contest.payoutAutoRunSpendCapSats}
              nwcEnabled={data.nwc.enabled}
              autoPayLabel={payoutCopy.autoPayAtEnd}
            />
          </Form>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!data.nwc.enabled || isBatchPayoutPending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("intent", "runBatchPayout");
                  fd.set("stepIndex", "0");
                  batchPayoutFetcher.submit(fd, { method: "post" });
                }}
                className="bg-primary text-primary-foreground disabled:bg-muted disabled:text-muted-foreground inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
                title={
                  data.nwc.enabled
                    ? "Pay all winners using your connected wallet"
                    : "Connect NWC in Settings to enable auto payouts"
                }
              >
                {isBatchPayoutPending ? (
                  <>
                    <Loader2
                      className="h-4 w-4 shrink-0 animate-spin"
                      aria-hidden
                    />
                    Paying winners…
                  </>
                ) : (
                  payoutCopy.payWinnersNow
                )}
              </button>
              {!data.nwc.enabled ? (
                <p className="text-muted-foreground text-xs">
                  Auto payout requires NWC. Manual zaps still work.
                </p>
              ) : null}
            </div>
            <PayoutProgressCard
              active={isBatchPayoutPending}
              progress={batchProgressSnapshot}
            />
            {batchPayoutFetcher.data &&
            batchPayoutFetcher.data.success === false &&
            batchPayoutFetcher.data.error ? (
              <p className="text-destructive text-xs">
                {batchPayoutFetcher.data.error}
              </p>
            ) : null}
          </div>
          <ContestPayoutOverview
            summary={data.payoutSummary}
            feeLabel={feeLabel}
          />
          <div className="border-border bg-card space-y-2 rounded-lg border p-3 text-sm">
            <p className="font-medium">
              {data.payoutSummary.paidOrSent} paid · {data.payoutSummary.failed}{" "}
              failed · {data.payoutSummary.needsReview} needs review ·{" "}
              {data.payoutSummary.skipped} skipped
            </p>
            <p className="text-muted-foreground text-xs">
              Retry failed payouts from recipient actions or switch to manual
              fallback in payout settings.
            </p>
          </div>
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
              Finish campaign
            </button>
          </Form>
        </div>
      ) : null}

      {isCompleted ? (
        <CampaignReceiptProofShell
          receiptTitle={contestCopy.receipt}
          receiptBody={
            <div className="space-y-3 text-sm">
              {data.payoutSummary.failed > 0 ||
              data.payoutSummary.needsReview > 0 ? (
                <p className="text-amber-700 dark:text-amber-300">
                  Completed with issues: {data.payoutSummary.failed} failed ·{" "}
                  {data.payoutSummary.needsReview} needs review.
                </p>
              ) : null}
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
                <div>
                  <dt className="text-muted-foreground">Paid via wallet</dt>
                  <dd>{data.payoutSummary.paidViaWallet}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Paid manually</dt>
                  <dd>{data.payoutSummary.paidManually}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Failed</dt>
                  <dd>{data.payoutSummary.failed}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Needs review</dt>
                  <dd>{data.payoutSummary.needsReview}</dd>
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
