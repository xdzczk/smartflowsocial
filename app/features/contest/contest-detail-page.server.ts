/**
 * Aggregates all data for the contest detail dashboard (loader-friendly JSON).
 */

import { getUserSubscription } from "~/features/payments/data";
import {
  getGiveawayPlanLimits,
  getPlanDisplayName,
  getUserPlanType,
} from "~/features/payments/types";
import type { UserSubscription } from "~/features/payments/types";
import { getPostById } from "~/features/posts/server";
import { getUserNWC, hasUsableNwc } from "~/features/user";

import { getContestById, getContestByIdPublic } from "./contest-actions.server";
import type { ContestDetailPageData } from "./contest-detail.types";
import { quoteContestFinalization } from "./contest-finalization-fee.server";
import { normalizeContestPayoutState } from "./contest-payout.server";
import {
  buildContestFairnessProofLines,
  buildContestPublicSummaryLines,
  buildContestReceiptSummaryLine,
} from "./contest-proof-share.server";
import { fetchContestPubkeyProfiles } from "./contest-pubkey-profiles.server";
import { resolveContestEntries } from "./contest-resolver.server";
import { formatContestStatusLabel } from "./contest-status-ui";
import type { Contest } from "./data/contest-prisma-types.server";
import {
  findContestEntriesForDetail,
  findContestEventLogs,
  findContestLaunchOrchestrationForDetail,
  findContestWinnersWithEntries,
  findLatestContestSnapshot,
} from "./repositories/contest-detail-queries.server";
import type { ContestRankReward } from "./types";

export type { ContestDetailPageData } from "./contest-detail.types";

const LIVE_PREVIEW_CAP = 50;

function contestDurationLabel(contest: Contest): string {
  const start = contest.contestStartAt ?? contest.createdAt;
  const ms = contest.contestEndAt.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "the contest window";
  const h = Math.round(ms / 3600000);
  if (h < 48) return `${Math.max(1, h)} hour(s)`;
  const d = Math.round(h / 24);
  return `${d} day(s)`;
}

function buildWinnerAnnouncement(contest: Contest, planned: number): string {
  const title = contest.title?.trim() ?? "Contest";
  const metric = contest.rankingMetric.toLowerCase();
  const n = contest.winnerCount;
  return `${title}: complete  -  top ${n} direct replies by ${metric}. ${planned.toLocaleString()} sats planned payout. Results locked from the frozen snapshot.`;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- single loader aggregates contest dashboard data
export async function getContestDetailPageData(
  userId: string,
  contestId: string
): Promise<ContestDetailPageData | null> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return null;

  const [nwc, nwcUsable] = await Promise.all([
    getUserNWC(userId),
    hasUsableNwc(userId),
  ]);

  const subscription = await getUserSubscription(userId);
  const planType = getUserPlanType(subscription as UserSubscription | null);
  const planLabel = getPlanDisplayName(subscription as UserSubscription | null);
  const canUsePresets = getGiveawayPlanLimits(planType).canUsePresets;

  const rankRewards =
    (contest.rankRewards as ContestRankReward[] | null) ?? null;
  const fairnessConfig =
    (contest.fairnessConfig as Record<string, unknown> | null) ?? null;

  const quoteSourceTrim = contest.sourceNoteId?.trim() ?? "";
  const quoteSourceId = quoteSourceTrim !== "" ? quoteSourceTrim : "pending";
  const quote = quoteContestFinalization({
    contest: {
      sourceNoteId: quoteSourceId,
      rankingMetric: contest.rankingMetric,
      contestEndAt: contest.contestEndAt,
      prizeMode: contest.prizeMode,
      winnerCount: contest.winnerCount,
      equalRewardSats: contest.equalRewardSats,
      rankRewards,
      fairnessConfig,
      tieBreakRule: contest.tieBreakRule,
      snapshotId: contest.freezeSnapshotAt?.toISOString() ?? null,
    },
    planType,
  });

  const sourcePost = contest.sourcePostId
    ? await getPostById({ id: contest.sourcePostId, userId })
    : null;

  const title = contest.title ?? `Contest ${contest.id.slice(0, 8)}`;
  const completedAtLabel = contest.completedAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(contest.completedAt)
    : null;

  const receiptSummaryLine =
    contest.status === "COMPLETED" && completedAtLabel && contest.sourceNoteId
      ? buildContestReceiptSummaryLine({
          sourceNoteId: contest.sourceNoteId,
          rankingMetric: contest.rankingMetric,
          winnerCount: contest.winnerCount,
          plannedPayoutSats: contest.plannedPayoutSats ?? 0,
          finalizationFeeSats: contest.finalizationFeeSats ?? 0,
          completedAtLabel,
        })
      : null;

  const publicSummaryText =
    contest.status === "COMPLETED"
      ? buildContestPublicSummaryLines({
          title,
          rankingMetric: contest.rankingMetric,
          winnerCount: contest.winnerCount,
          plannedPayoutSats: contest.plannedPayoutSats ?? 0,
          durationLabel: contestDurationLabel(contest),
          completedAtLabel: completedAtLabel ?? undefined,
        }).join("\n")
      : null;

  const winnerAnnouncementText =
    contest.status === "COMPLETED"
      ? buildWinnerAnnouncement(contest, contest.plannedPayoutSats ?? 0)
      : null;

  let livePreview: ContestDetailPageData["livePreview"] = [];
  let liveStats: ContestDetailPageData["liveStats"] = null;

  if (contest.status === "LIVE" && contest.sourceNoteId) {
    const nowUnix = Math.floor(Date.now() / 1000);
    const endUnix = Math.floor(contest.contestEndAt.getTime() / 1000);
    /** Rank as-of now: replies up to min(now, end)  -  documented product rule. */
    const deadlineUnix = Math.min(nowUnix, endUnix);
    const resolved = await resolveContestEntries({
      userId,
      sourceNoteId: contest.sourceNoteId,
      metric: contest.rankingMetric,
      deadlineUnix,
      filters: fairnessConfig ?? undefined,
    });
    const capped = resolved.slice(0, LIVE_PREVIEW_CAP);
    livePreview = capped.map((row, idx) => ({
      rank: idx + 1,
      entryEventId: row.entryEventId,
      authorPubkey: row.authorPubkey,
      replySnippet: row.replySnippet ?? null,
      score: row.score,
      reactionsCount: row.reactionsCount,
      zapCount: row.zapCount,
      satsZapped: row.satsZapped,
      repliesCount: row.repliesCount,
      repostsCount: row.repostsCount,
      createdAtUnix: row.createdAtUnix,
    }));
    const pubkeys = capped.map((r) => r.authorPubkey);
    const uniqueParticipants = new Set(pubkeys).size;
    const leadingScore = capped.length > 0 ? (capped[0]?.score ?? 0) : 0;
    let metricSum = 0;
    for (const r of capped) {
      metricSum += r.score;
    }
    liveStats = {
      totalEntries: capped.length,
      uniqueParticipants,
      leadingScore,
      metricSum,
    };
  }

  let winnersRaw = await findContestWinnersWithEntries(contestId);
  let eligible: Awaited<ReturnType<typeof findContestEntriesForDetail>> = [];
  let excluded: typeof eligible = [];

  const frozenOrDone =
    contest.status === "ENDED_REVIEW" ||
    contest.status === "LOCKED" ||
    contest.status === "PAYOUT_IN_PROGRESS" ||
    contest.status === "COMPLETED";

  if (frozenOrDone) {
    const allEntries = await findContestEntriesForDetail(contestId, {
      includeExcluded: true,
    });
    eligible = allEntries.filter((e) => !e.isExcluded);
    excluded = allEntries.filter((e) => e.isExcluded);
  } else if (contest.status !== "LIVE" && contest.status !== "DRAFT") {
    eligible = await findContestEntriesForDetail(contestId, {
      includeExcluded: false,
    });
  }

  const winnerPubkeys = winnersRaw
    .filter((w) => !w.isAlternate)
    .map((w) => w.entry.authorPubkey);
  const payoutState = normalizeContestPayoutState(
    contest.payoutState,
    winnerPubkeys
  );

  const winners = winnersRaw.map((w) => ({
    id: w.id,
    rank: w.rank,
    rewardSats: w.rewardSats,
    isAlternate: w.isAlternate,
    score: w.entry.score,
    authorPubkey: w.entry.authorPubkey,
    entryEventId: w.entry.entryEventId,
    replySnippet: w.entry.replySnippet,
    payoutStatus:
      payoutState[w.entry.authorPubkey]?.status ?? w.payoutStatus ?? "pending",
    payoutNote: payoutState[w.entry.authorPubkey]?.note,
  }));

  const leaderboardEligible = eligible.map((row) => ({
    rank: row.rank,
    score: row.score,
    authorPubkey: row.authorPubkey,
    entryEventId: row.entryEventId,
    replySnippet: row.replySnippet,
    createdAtUnix: row.createdAtUnix,
    reactionsCount: row.reactionsCount,
    zapCount: row.zapCount,
    satsZapped: row.satsZapped,
    repliesCount: row.repliesCount,
    repostsCount: row.repostsCount,
    isExcluded: row.isExcluded,
  }));

  const leaderboardExcluded = excluded.map((row) => ({
    rank: row.rank,
    score: row.score,
    authorPubkey: row.authorPubkey,
    entryEventId: row.entryEventId,
    replySnippet: row.replySnippet,
    exclusionReason: row.exclusionReason,
    createdAtUnix: row.createdAtUnix,
  }));

  const snapshotRow = frozenOrDone
    ? await findLatestContestSnapshot(contestId)
    : null;

  const eventLogRows = await findContestEventLogs(contestId);

  const pubkeysToEnrich = new Set<string>();
  for (const w of winners) pubkeysToEnrich.add(w.authorPubkey);
  for (const row of leaderboardEligible) pubkeysToEnrich.add(row.authorPubkey);
  for (const row of leaderboardExcluded) pubkeysToEnrich.add(row.authorPubkey);
  for (const row of livePreview) pubkeysToEnrich.add(row.authorPubkey);
  const profiles = await fetchContestPubkeyProfiles([...pubkeysToEnrich]);

  let totalReactions = 0;
  let totalZaps = 0;
  let totalSatsZapped = 0;
  let totalReplies = 0;
  let totalReposts = 0;
  const rowsForAgg = frozenOrDone ? eligible : [];
  for (const row of rowsForAgg) {
    totalReactions += row.reactionsCount;
    totalZaps += row.zapCount;
    totalSatsZapped += row.satsZapped;
    totalReplies += row.repliesCount;
    totalReposts += row.repostsCount;
  }
  if (contest.status === "LIVE" && livePreview.length > 0) {
    totalReactions = 0;
    totalZaps = 0;
    totalSatsZapped = 0;
    totalReplies = 0;
    totalReposts = 0;
    for (const row of livePreview) {
      totalReactions += row.reactionsCount;
      totalZaps += row.zapCount;
      totalSatsZapped += row.satsZapped;
      totalReplies += row.repliesCount;
      totalReposts += row.repostsCount;
    }
  }

  let paidOrSent = 0;
  let pending = 0;
  let failed = 0;
  let needsReview = 0;
  let skipped = 0;
  let paidViaWallet = 0;
  let paidManually = 0;
  for (const pk of winnerPubkeys) {
    // Status can include legacy/ledger values from persisted snapshots.
    const st: string = payoutState[pk]?.status ?? "pending";
    if (st === "sent") {
      paidOrSent += 1;
      paidViaWallet += 1;
    } else if (st === "marked_paid") {
      paidOrSent += 1;
      paidManually += 1;
    } else if (st === "failed") {
      failed += 1;
    } else if (st === "claim_needed" || st === "needs_review") {
      needsReview += 1;
    } else if (st === "skipped") {
      skipped += 1;
    } else {
      pending += 1;
    }
  }

  const launchOrchestrationRow = await findContestLaunchOrchestrationForDetail(
    contest.id
  );

  const fairnessProofText =
    contest.status === "COMPLETED"
      ? JSON.stringify(
          {
            snapshot: snapshotRow
              ? {
                  snapshotAt: snapshotRow.snapshotAt.toISOString(),
                  totalEntries: snapshotRow.totalEntries,
                  eligibleEntries: snapshotRow.eligibleEntries,
                  excludedEntries: snapshotRow.excludedEntries,
                  rankingMetric: snapshotRow.rankingMetric,
                  tieBreakRule: snapshotRow.tieBreakRule,
                }
              : null,
            fairnessConfig,
            tieBreakRule: contest.tieBreakRule,
            entryType: contest.entryType,
            lockConfigHash: contest.lockConfigHash ?? quote.lockConfigHash,
          },
          null,
          2
        )
      : null;

  return {
    nwc: {
      enabled: nwc.enabled,
      usable: nwcUsable,
      maskedString: nwc.maskedString ?? null,
      lastUsed: nwc.lastUsed ? nwc.lastUsed.toISOString() : null,
    },
    contest: {
      id: contest.id,
      title,
      sourceNoteId: contest.sourceNoteId,
      sourcePostId: contest.sourcePostId,
      status: contest.status,
      statusLabel: formatContestStatusLabel(contest.status),
      rankingMetric: contest.rankingMetric,
      contestEndAt: contest.contestEndAt.toISOString(),
      contestStartAt: contest.contestStartAt?.toISOString() ?? null,
      createdAt: contest.createdAt.toISOString(),
      winnerCount: contest.winnerCount,
      prizeMode: contest.prizeMode,
      equalRewardSats: contest.equalRewardSats,
      rankRewards,
      plannedPayoutSats: contest.plannedPayoutSats ?? quote.plannedPayoutSats,
      finalizationFeeSats: contest.finalizationFeeSats ?? quote.feeSats,
      finalizationFeeStatus: contest.finalizationFeeStatus ?? null,
      finalizationFeeRateBps: quote.feeRateBps,
      planLabel,
      freezeSnapshotAt: contest.freezeSnapshotAt?.toISOString() ?? null,
      lockConfigHash: contest.lockConfigHash ?? quote.lockConfigHash,
      payoutState: payoutState,
      payoutWalletMode: contest.payoutWalletMode,
      payoutAutoRunEnabled: contest.payoutAutoRunEnabled,
      payoutAutoRunSpendCapSats: contest.payoutAutoRunSpendCapSats ?? null,
      fairnessConfig,
      tieBreakRule: contest.tieBreakRule,
      entryType: contest.entryType,
      completedAt: contest.completedAt?.toISOString() ?? null,
      lockedAt: contest.lockedAt?.toISOString() ?? null,
    },
    quote: {
      plannedPayoutSats: quote.plannedPayoutSats,
      feeSats: quote.feeSats,
      feeRateBps: quote.feeRateBps,
      lockConfigHash: quote.lockConfigHash,
      waivedByPlan: quote.waivedByPlan,
    },
    sourcePost: sourcePost
      ? {
          id: sourcePost.id,
          caption: sourcePost.caption ?? null,
          fileUrl: Array.isArray(sourcePost.fileUrl) ? sourcePost.fileUrl : [],
          publishedAt: sourcePost.publishedAt?.toISOString() ?? null,
          nostrEventId: sourcePost.nostrEventId ?? null,
        }
      : null,
    livePreview,
    liveStats,
    winners,
    leaderboardEligible,
    leaderboardExcluded,
    snapshot: snapshotRow
      ? {
          snapshotAt: snapshotRow.snapshotAt.toISOString(),
          totalEntries: snapshotRow.totalEntries,
          eligibleEntries: snapshotRow.eligibleEntries,
          excludedEntries: snapshotRow.excludedEntries,
          rankingMetric: snapshotRow.rankingMetric,
          tieBreakRule: snapshotRow.tieBreakRule,
        }
      : null,
    eventLogs: eventLogRows.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
      metadata: e.metadata,
    })),
    profiles,
    receiptSummaryLine,
    publicSummaryText,
    winnerAnnouncementText,
    fairnessProofText,
    aggregates: {
      totalReactions,
      totalZaps,
      totalSatsZapped,
      totalReplies,
      totalReposts,
    },
    payoutSummary: {
      winnerSlots: winnerPubkeys.length,
      paidOrSent,
      pending,
      failed,
      needsReview,
      skipped,
      paidViaWallet,
      paidManually,
      plannedSats: contest.plannedPayoutSats ?? quote.plannedPayoutSats,
    },
    canUsePresets,
    launchOrchestration: launchOrchestrationRow
      ? {
          sourceMode: launchOrchestrationRow.sourceMode,
          launchMode: launchOrchestrationRow.launchMode,
          sourcePostId: launchOrchestrationRow.sourcePostId,
          sourcePostPublishStatus:
            launchOrchestrationRow.sourcePostPublishStatus,
          contestActivationStatus:
            launchOrchestrationRow.contestActivationStatus,
          lastErrorMessage: launchOrchestrationRow.lastErrorMessage,
          lastErrorCode: launchOrchestrationRow.lastErrorCode,
          scheduledFor:
            launchOrchestrationRow.scheduledFor?.toISOString() ?? null,
        }
      : null,
  };
}

export async function getContestPublicPageData(contestId: string) {
  const contest = await getContestByIdPublic(contestId);
  if (!contest) return null;
  if (
    contest.status !== "LIVE" &&
    contest.status !== "ENDED_REVIEW" &&
    contest.status !== "LOCKED" &&
    contest.status !== "PAYOUT_IN_PROGRESS" &&
    contest.status !== "COMPLETED"
  ) {
    return null;
  }

  let rows: Array<{
    rank: number;
    authorPubkey: string;
    score: number;
    entryEventId: string;
    replySnippet: string | null;
  }> = [];
  if (contest.status === "LIVE" && contest.sourceNoteId) {
    const resolved = await resolveContestEntries({
      userId: contest.userId,
      sourceNoteId: contest.sourceNoteId,
      metric: contest.rankingMetric,
      deadlineUnix: Math.min(
        Math.floor(Date.now() / 1000),
        Math.floor(contest.contestEndAt.getTime() / 1000)
      ),
      filters:
        (contest.fairnessConfig as Record<string, unknown> | null) ?? undefined,
    });
    rows = resolved.slice(0, 10).map((r, idx) => ({
      rank: idx + 1,
      authorPubkey: r.authorPubkey,
      score: r.score,
      entryEventId: r.entryEventId,
      replySnippet: r.replySnippet ?? null,
    }));
  } else {
    const entries = await findContestEntriesForDetail(contest.id, {
      includeExcluded: false,
    });
    rows = entries.slice(0, 10).map((r, idx) => ({
      rank: r.rank ?? idx + 1,
      authorPubkey: r.authorPubkey,
      score: r.score,
      entryEventId: r.entryEventId,
      replySnippet: r.replySnippet,
    }));
  }

  const snap =
    contest.status !== "LIVE"
      ? await findLatestContestSnapshot(contest.id)
      : null;
  const eligibleEntries = snap?.eligibleEntries ?? null;

  const durationLabel = contestDurationLabel(contest);
  const completedAt = contest.completedAt ?? contest.updatedAt;
  const completedAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(completedAt);

  const publicSummaryLines =
    contest.status === "COMPLETED"
      ? buildContestPublicSummaryLines({
          title: contest.title ?? `Contest ${contest.id.slice(0, 8)}`,
          rankingMetric: contest.rankingMetric,
          winnerCount: contest.winnerCount,
          plannedPayoutSats: contest.plannedPayoutSats ?? 0,
          durationLabel,
          completedAtLabel,
        })
      : null;

  const fairnessProofLines =
    contest.status === "COMPLETED"
      ? buildContestFairnessProofLines({
          title: contest.title ?? `Contest ${contest.id.slice(0, 8)}`,
          eligibleEntries,
          tieBreakRule: contest.tieBreakRule,
          entryType: contest.entryType,
          lockedOrCompletedAt: completedAtLabel,
        })
      : null;

  return {
    id: contest.id,
    title: contest.title ?? `Contest ${contest.id.slice(0, 8)}`,
    status: contest.status,
    rankingMetric: contest.rankingMetric,
    contestEndAt: contest.contestEndAt.toISOString(),
    winnerCount: contest.winnerCount,
    plannedPayoutSats: contest.plannedPayoutSats ?? 0,
    sourceNoteId: contest.sourceNoteId,
    rows,
    eligibleEntries,
    publicSummaryLines,
    fairnessProofLines,
  };
}
