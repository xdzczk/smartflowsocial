import type { ContestRankReward, ContestStatus } from "./types";

/** JSON-serializable contest detail payload (loader + client UI). */
export interface ContestDetailPageData {
  nwc: {
    enabled: boolean;
    maskedString: string | null;
    lastUsed: string | null;
  };
  contest: {
    id: string;
    title: string;
    sourceNoteId: string;
    sourcePostId: string | null;
    status: ContestStatus;
    statusLabel: string;
    rankingMetric: string;
    contestEndAt: string;
    contestStartAt: string | null;
    createdAt: string;
    winnerCount: number;
    prizeMode: string;
    equalRewardSats: number | null;
    rankRewards: ContestRankReward[] | null;
    plannedPayoutSats: number;
    finalizationFeeSats: number;
    finalizationFeeStatus: string | null;
    finalizationFeeRateBps: number;
    planLabel: string;
    freezeSnapshotAt: string | null;
    lockConfigHash: string | null;
    payoutState: Record<
      string,
      { status: string; updatedAt?: string; note?: string }
    > | null;
    payoutWalletMode: "manual" | "nwc_creator";
    payoutAutoRunEnabled: boolean;
    payoutAutoRunSpendCapSats: number | null;
    fairnessConfig: Record<string, unknown> | null;
    tieBreakRule: string | null;
    entryType: string;
    completedAt: string | null;
    lockedAt: string | null;
  };
  quote: {
    plannedPayoutSats: number;
    feeSats: number;
    feeRateBps: number;
    lockConfigHash: string;
    waivedByPlan: boolean;
  };
  sourcePost: null | {
    id: string;
    caption: string | null;
    fileUrl: string[];
    publishedAt: string | null;
    nostrEventId: string | null;
  };
  livePreview: Array<{
    rank: number;
    entryEventId: string;
    authorPubkey: string;
    replySnippet: string | null;
    score: number;
    reactionsCount: number;
    zapCount: number;
    satsZapped: number;
    createdAtUnix: number;
  }>;
  liveStats: {
    totalEntries: number;
    uniqueParticipants: number;
    leadingScore: number;
    metricSum: number;
  } | null;
  winners: Array<{
    id: string;
    rank: number;
    rewardSats: number;
    isAlternate: boolean;
    score: number;
    authorPubkey: string;
    entryEventId: string;
    replySnippet: string | null;
    payoutStatus: string;
  }>;
  leaderboardEligible: Array<{
    rank: number | null;
    score: number;
    authorPubkey: string;
    entryEventId: string;
    replySnippet: string | null;
    createdAtUnix: number;
    reactionsCount: number;
    zapCount: number;
    satsZapped: number;
    isExcluded: boolean;
  }>;
  leaderboardExcluded: Array<{
    rank: number | null;
    score: number;
    authorPubkey: string;
    entryEventId: string;
    replySnippet: string | null;
    exclusionReason: string | null;
    createdAtUnix: number;
  }>;
  snapshot: null | {
    snapshotAt: string;
    totalEntries: number;
    eligibleEntries: number;
    excludedEntries: number;
    rankingMetric: string;
    tieBreakRule: string;
  };
  eventLogs: Array<{
    id: string;
    eventType: string;
    message: string;
    createdAt: string;
    metadata: unknown;
  }>;
  profiles: Record<
    string,
    {
      pubkey: string;
      npub: string;
      displayName: string;
      picture: string | null;
    }
  >;
  receiptSummaryLine: string | null;
  publicSummaryText: string | null;
  winnerAnnouncementText: string | null;
  /** Structured fairness proof for copy/export when completed. */
  fairnessProofText: string | null;
  aggregates: {
    totalReactions: number;
    totalZaps: number;
    totalSatsZapped: number;
  };
  payoutSummary: {
    winnerSlots: number;
    paidOrSent: number;
    pending: number;
    failed: number;
    plannedSats: number;
  };
  /** Same gate as giveaway presets (paid plans). */
  canUsePresets: boolean;
}
