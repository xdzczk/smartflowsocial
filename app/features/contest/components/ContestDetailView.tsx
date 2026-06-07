import type { SerializeFrom } from "@remix-run/node";
import { useRouteLoaderData } from "@remix-run/react";
import { useCallback, useMemo } from "react";

import { mapContestCampaignPhase } from "~/features/campaign-ui";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";

import { contestCopy } from "../contest-copy";
import type {
  ContestLeaderboardEntryRow,
  ContestLivePreviewRow,
  ContestProfileMap,
  ContestWinnerRow,
} from "../contest-detail-ui.types";
import type { ContestDetailPageData } from "../contest-detail.types";
import type { ContestRankingMetric } from "../types";

import { ContestActivityLog } from "./ContestActivityLog";
import {
  ContestDetailBackLink,
  ContestDetailCancelledLayout,
  ContestDetailCancelSection,
  ContestDetailExcludedSection,
  ContestDetailFairnessSection,
  ContestDetailFormsSection,
  ContestDetailFrozenSection,
  ContestDetailHeroHeader,
  ContestDetailLiveSection,
  ContestDetailSourceSection,
  ContestPublicShareRow,
} from "./ContestDetailSections";
import { ContestLaunchRecoveryPanel } from "./ContestLaunchRecoveryPanel";
import { ContestStateBanner } from "./ContestStateBanner";

function rootUserFromData(
  data: unknown
): Parameters<typeof getNostrClientUrlsFromUser>[0] {
  if (!data || typeof data !== "object") return null;
  const u = (data as { user?: unknown }).user;
  if (!u || typeof u !== "object") return null;
  return u;
}

function headerToneClassForStatus(status: string): string {
  if (status === "ENDED_REVIEW") {
    return "border-info/40 bg-info/5";
  }
  if (status === "LOCKED" || status === "PAYOUT_IN_PROGRESS") {
    return "border-warning/40 bg-warning/5";
  }
  if (status === "COMPLETED") {
    return "border-success/40 bg-success/5";
  }
  return "border-border bg-surface";
}

function stateSummaryForContest(status: string, statusLabel: string): string {
  switch (status) {
    case "DRAFT":
      return "Configure source, ranking, and rewards before launch.";
    case "SCHEDULED_LAUNCH":
      return "Launch is scheduled. The source post will publish first when applicable, then the contest activates.";
    case "LIVE":
      return "Entries are open. Leaderboard updates in real time.";
    case "ENDED_REVIEW":
      return "Leaderboard is frozen for review. Lock winners when ready.";
    case "LOCKED":
    case "PAYOUT_IN_PROGRESS":
      return "Winners are locked. Track payouts and complete when settled.";
    case "COMPLETED":
      return "Contest complete. Receipt and public proof are available below.";
    default:
      return statusLabel;
  }
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
  const isDraft =
    contest.status === "DRAFT" || contest.status === "SCHEDULED_LAUNCH";
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

  const frozenRows: ContestLeaderboardEntryRow[] = useMemo(
    () =>
      data.leaderboardEligible.map((r) => ({
        rank: r.rank,
        score: r.score,
        authorPubkey: r.authorPubkey,
        entryEventId: r.entryEventId,
        replySnippet: r.replySnippet,
        createdAtUnix: r.createdAtUnix,
        reactionsCount: r.reactionsCount,
        zapCount: r.zapCount,
        satsZapped: r.satsZapped,
        repliesCount: r.repliesCount,
        repostsCount: r.repostsCount,
      })),
    [data.leaderboardEligible]
  );

  const liveRows: ContestLivePreviewRow[] = data.livePreview;

  const metric = contest.rankingMetric as ContestRankingMetric;

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

  const openSource = useCallback(() => {
    if (contest.sourceNoteId && nostr.eventUrl(contest.sourceNoteId)) {
      window.open(nostr.eventUrl(contest.sourceNoteId), "_blank");
    }
  }, [contest.sourceNoteId, nostr]);

  const feePct =
    data.quote.feeRateBps > 0
      ? `${(data.quote.feeRateBps / 100).toFixed(1)}%`
      : "0%";
  const feeLabel = `Finalization fee (${feePct} on plan ${contest.planLabel})`;
  const statusTimestamp =
    contest.completedAt ??
    contest.lockedAt ??
    contest.freezeSnapshotAt ??
    contest.contestStartAt ??
    contest.createdAt;

  const headerToneClass = headerToneClassForStatus(contest.status);
  const stateSummary = stateSummaryForContest(
    contest.status,
    contest.statusLabel
  );
  const hasPayoutIssues =
    data.payoutSummary.failed > 0 || data.payoutSummary.needsReview > 0;
  const phaseLabel = mapContestCampaignPhase(contest.status, hasPayoutIssues);

  const showFrozenLeaderboard =
    !isLive && (frozenRows.length > 0 || isReview || isLocked || isCompleted);

  if (isCancelled) {
    return <ContestDetailCancelledLayout contest={contest} metric={metric} />;
  }

  return (
    <div className="space-y-6">
      <ContestDetailBackLink />

      <ContestDetailHeroHeader
        contest={contest}
        metric={metric}
        headerToneClass={headerToneClass}
        stateSummary={stateSummary}
        statusTimestamp={statusTimestamp}
        phaseLabel={phaseLabel}
      />

      {!isDraft ? <ContestPublicShareRow contestId={contest.id} /> : null}

      <div className="min-w-0 space-y-6">
        <ContestStateBanner status={contest.status} />

        <ContestLaunchRecoveryPanel
          contestStatus={contest.status}
          launchOrchestration={data.launchOrchestration}
        />

        <ContestDetailSourceSection
          sourcePost={data.sourcePost}
          sourceNoteId={contest.sourceNoteId}
          onOpenNostr={openSource}
        />

        {isLive ? (
          <ContestDetailLiveSection
            contest={contest}
            data={data}
            metric={metric}
            profiles={profiles}
            winners={winners}
            liveRows={liveRows}
            announcementText={announcementText}
            updateText={updateText}
          />
        ) : null}

        <ContestDetailFrozenSection
          showFrozen={showFrozenLeaderboard}
          frozenRows={frozenRows}
          contest={contest}
          metric={metric}
          profiles={profiles}
          winners={winners}
          aggregates={data.aggregates}
        />

        <ContestDetailExcludedSection excludedByReason={excludedByReason} />

        <ContestDetailFairnessSection
          showFairness={isReview || isLocked || isCompleted}
          snapshot={data.snapshot}
          tieBreakRule={contest.tieBreakRule}
          entryType={contest.entryType}
          fairnessConfig={contest.fairnessConfig}
          alternatesCount={alternatesCount}
        />

        <ContestActivityLog events={data.eventLogs} />

        <ContestDetailFormsSection
          contest={contest}
          data={data}
          isDraft={isDraft}
          isReview={isReview}
          isLocked={isLocked}
          isCompleted={isCompleted}
          feeLabel={feeLabel}
          metric={metric}
          winners={winners}
          nostr={nostr}
          canUsePresets={data.canUsePresets}
        />

        <ContestDetailCancelSection
          showCancel={isDraft || isLive || isReview}
        />
      </div>
    </div>
  );
}
