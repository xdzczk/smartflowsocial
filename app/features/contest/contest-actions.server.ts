/* eslint-disable no-restricted-imports, import/order, sonarjs/no-duplicate-string, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/consistent-type-assertions -- Contest v1 domain scaffolding will be hardened in follow-up cleanup. */
import { getUserSubscription } from "~/features/payments/data";
import { getPlanDisplayName, getUserPlanType } from "~/features/payments/types";
import type { UserSubscription } from "~/features/payments/types";
import { prisma } from "~/lib/prisma.server";

import { Prisma } from "./data/contest-prisma-types.server";
import type { Contest } from "./data/contest-prisma-types.server";
import { quoteContestFinalization } from "./contest-finalization-fee.server";
import {
  allContestWinnersSettled,
  buildInitialContestPayoutState,
  normalizeContestPayoutState,
  type ContestPayoutEntryStatus,
} from "./contest-payout.server";
import { resolveContestEntries } from "./contest-resolver.server";
import {
  findContestByIdAndUser,
  findContestByIdPublic,
  listContestsByUser,
  listContestsByUserWithFilters,
  createContest as createContestRow,
  updateContest as updateContestRow,
  deleteContest as deleteContestRow,
} from "./repositories/contest-actions-data.server";
import { findPaidContestFinalizationForLock } from "./repositories/contest-finalization-payment.server";
import type { ContestRankReward } from "./types";

const DEFAULT_TIE_BREAK_RULE =
  "primary metric desc, earlier reply timestamp asc, entry event id lexicographic asc";

export async function getContestById(
  id: string,
  userId: string
): Promise<Contest | null> {
  return findContestByIdAndUser(id, userId);
}

export async function getContestByIdPublic(
  id: string
): Promise<Contest | null> {
  return findContestByIdPublic(id);
}

export async function createContest(
  userId: string,
  input: {
    title?: string | null;
    sourceNoteId: string;
    sourcePostId?: string | null;
    rankingMetric: "REACTIONS" | "ZAPS" | "SATS_ZAPPED";
    contestStartAt?: Date | null;
    contestEndAt: Date;
    prizeMode: "EQUAL" | "RANKED";
    winnerCount: number;
    equalRewardSats?: number | null;
    rankRewards?: ContestRankReward[] | null;
    fairnessConfig?: Record<string, unknown> | null;
  }
): Promise<Contest> {
  return createContestRow({
    user: { connect: { id: userId } },
    title: input.title?.trim() || null,
    sourceNoteId: input.sourceNoteId,
    sourcePostId: input.sourcePostId ?? null,
    rankingMetric: input.rankingMetric,
    contestStartAt: input.contestStartAt ?? null,
    contestEndAt: input.contestEndAt,
    prizeMode: input.prizeMode,
    winnerCount: Math.max(1, Math.min(input.winnerCount, 50)),
    equalRewardSats:
      input.prizeMode === "EQUAL"
        ? Math.max(0, input.equalRewardSats ?? 0)
        : null,
    rankRewards:
      input.prizeMode === "RANKED"
        ? ((input.rankRewards ?? []) as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    fairnessConfig: (input.fairnessConfig ?? undefined) as
      | Prisma.InputJsonValue
      | undefined,
    entryType: "REPLY_DIRECT",
    tieBreakRule: DEFAULT_TIE_BREAK_RULE,
    status: "DRAFT",
    eventLogs: {
      create: {
        eventType: "contest_created",
        message: "Contest created as draft",
      },
    },
  });
}

export async function launchContest(
  userId: string,
  contestId: string
): Promise<{ success: boolean; error?: string }> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (contest.status !== "DRAFT")
    return { success: false, error: "Only draft contests can be launched" };

  await updateContestRow(contestId, {
    status: "LIVE",
    contestStartAt: contest.contestStartAt ?? new Date(),
    eventLogs: {
      create: {
        eventType: "contest_launched",
        message: "Contest launched and leaderboard is live",
      },
    },
  });
  return { success: true };
}

export async function freezeContestAtDeadline(
  userId: string,
  contestId: string
): Promise<{ success: boolean; error?: string }> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (contest.status !== "LIVE" && contest.status !== "ENDED_REVIEW") {
    return { success: false, error: "Contest is not in a freezeable state" };
  }
  const snapshotAt = new Date();
  const entries = await resolveContestEntries({
    userId,
    sourceNoteId: contest.sourceNoteId,
    metric: contest.rankingMetric,
    deadlineUnix: Math.floor(contest.contestEndAt.getTime() / 1000),
    filters:
      (contest.fairnessConfig as Record<string, unknown> | null) ?? undefined,
  });

  const winnerCount = Math.max(1, contest.winnerCount);
  const winners = entries.slice(0, winnerCount);
  const alternates = entries.slice(winnerCount, winnerCount + winnerCount);
  const rewardForRank = (rank: number): number => {
    if (contest.prizeMode === "EQUAL") return contest.equalRewardSats ?? 0;
    const rewards = (contest.rankRewards as ContestRankReward[] | null) ?? [];
    return rewards.find((r) => r.rank === rank)?.sats ?? 0;
  };

  await prisma.$transaction(async (tx) => {
    const snapshot = await tx.contestSnapshot.create({
      data: {
        contestId,
        snapshotAt,
        deadlineAt: contest.contestEndAt,
        rankingMetric: contest.rankingMetric,
        tieBreakRule: contest.tieBreakRule ?? DEFAULT_TIE_BREAK_RULE,
        totalEntries: entries.length,
        eligibleEntries: entries.length,
        excludedEntries: 0,
      },
    });

    const createdEntries = await Promise.all(
      entries.map((row, idx) =>
        tx.contestEntry.create({
          data: {
            contestId,
            snapshotId: snapshot.id,
            entryEventId: row.entryEventId,
            authorPubkey: row.authorPubkey,
            createdAtUnix: row.createdAtUnix,
            replySnippet: row.replySnippet ?? null,
            reactionsCount: row.reactionsCount,
            zapCount: row.zapCount,
            satsZapped: row.satsZapped,
            score: row.score,
            rank: idx + 1,
            isEligible: true,
            isExcluded: false,
            snapshotAt,
          },
        })
      )
    );

    await tx.contestWinner.deleteMany({ where: { contestId } });
    const entryByEventId = new Map(
      createdEntries.map((row) => [row.entryEventId, row.id])
    );

    for (let idx = 0; idx < winners.length; idx += 1) {
      const row = winners[idx];
      if (!row) continue;
      const entryId = entryByEventId.get(row.entryEventId);
      if (!entryId) continue;
      await tx.contestWinner.create({
        data: {
          contestId,
          entryId,
          rank: idx + 1,
          rewardSats: rewardForRank(idx + 1),
          isAlternate: false,
        },
      });
    }

    for (let idx = 0; idx < alternates.length; idx += 1) {
      const row = alternates[idx];
      if (!row) continue;
      const entryId = entryByEventId.get(row.entryEventId);
      if (!entryId) continue;
      await tx.contestWinner.create({
        data: {
          contestId,
          entryId,
          rank: winnerCount + idx + 1,
          rewardSats: 0,
          isAlternate: true,
        },
      });
    }

    await tx.contest.update({
      where: { id: contestId },
      data: {
        status: "ENDED_REVIEW",
        freezeSnapshotAt: snapshotAt,
        freezeSnapshotWindowEndsAt: snapshotAt,
      },
    });

    await tx.contestEventLog.create({
      data: {
        contestId,
        eventType: "leaderboard_frozen",
        message: "Contest ended and leaderboard was frozen for review",
        metadata: {
          entries: entries.length,
          winners: winners.length,
        } as Prisma.InputJsonValue,
      },
    });
  });

  return { success: true };
}

export async function lockContest(
  userId: string,
  contestId: string,
  options?: { lockConfigHash?: string }
): Promise<{ success: boolean; error?: string }> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (contest.status === "LOCKED") return { success: true };
  if (contest.status !== "ENDED_REVIEW")
    return { success: false, error: "Only ended contests can be locked" };

  const subscription = await getUserSubscription(userId);
  const planType = getUserPlanType(subscription as UserSubscription | null);
  const quote = quoteContestFinalization({
    contest: {
      sourceNoteId: contest.sourceNoteId,
      rankingMetric: contest.rankingMetric,
      contestEndAt: contest.contestEndAt,
      prizeMode: contest.prizeMode,
      winnerCount: contest.winnerCount,
      equalRewardSats: contest.equalRewardSats,
      rankRewards: (contest.rankRewards as ContestRankReward[] | null) ?? [],
      fairnessConfig: contest.fairnessConfig,
      tieBreakRule: contest.tieBreakRule,
      snapshotId: contest.freezeSnapshotAt?.toISOString() ?? null,
    },
    planType,
  });

  if (
    options?.lockConfigHash &&
    options.lockConfigHash !== quote.lockConfigHash
  ) {
    return {
      success: false,
      error: "Contest preview changed. Refresh before lock.",
    };
  }

  if (quote.feeSats > 0) {
    const paid = await findPaidContestFinalizationForLock(
      contestId,
      userId,
      quote.lockConfigHash
    );
    if (!paid) {
      return {
        success: false,
        error: "Pay finalization fee before locking winners.",
      };
    }
  }

  const winnerRows = await prisma.contestWinner.findMany({
    where: { contestId, isAlternate: false },
    include: { entry: true },
    orderBy: { rank: "asc" },
  });
  const winnerPubkeys = winnerRows.map((row) => row.entry.authorPubkey);

  await updateContestRow(contestId, {
    status: "LOCKED",
    lockedAt: new Date(),
    plannedPayoutSats: quote.plannedPayoutSats,
    finalizationFeeRateBps: quote.feeRateBps,
    finalizationFeeSats: quote.feeSats,
    finalizationFeeStatus:
      quote.plannedPayoutSats <= 0
        ? "NONE"
        : quote.feeSats <= 0
          ? "WAIVED"
          : "PAID",
    planAtFinalization: getPlanDisplayName(
      subscription as UserSubscription | null
    ),
    lockConfigHash: quote.lockConfigHash,
    payoutState: buildInitialContestPayoutState(
      winnerPubkeys
    ) as unknown as Prisma.InputJsonValue,
    eventLogs: {
      create: {
        eventType: "winners_locked",
        message: "Winners were locked and payout is now available",
      },
    },
  });
  return { success: true };
}

export async function setContestWinnerPayoutStatus(
  userId: string,
  contestId: string,
  winnerPubkey: string,
  status: ContestPayoutEntryStatus,
  note?: string | null
): Promise<{ success: boolean; error?: string }> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (contest.status !== "LOCKED" && contest.status !== "PAYOUT_IN_PROGRESS") {
    return { success: false, error: "Contest is not in payout state" };
  }

  const winners = await prisma.contestWinner.findMany({
    where: { contestId, isAlternate: false },
    include: { entry: true },
  });
  const winnerPubkeys = winners.map((row) => row.entry.authorPubkey);
  if (!winnerPubkeys.includes(winnerPubkey)) {
    return { success: false, error: "Winner not found in locked set" };
  }

  const state = normalizeContestPayoutState(contest.payoutState, winnerPubkeys);
  state[winnerPubkey] = {
    status,
    updatedAt: new Date().toISOString(),
    ...(note?.trim() ? { note: note.trim() } : {}),
  };

  await updateContestRow(contestId, {
    status: "PAYOUT_IN_PROGRESS",
    payoutState: state as unknown as Prisma.InputJsonValue,
    eventLogs: {
      create: {
        eventType: "payout_status_updated",
        message: `Payout status updated (${status})`,
        metadata: {
          winnerPubkey,
          status,
        } as Prisma.InputJsonValue,
      },
    },
  });
  return { success: true };
}

export async function completeContest(
  userId: string,
  contestId: string,
  options?: { completeOverrideReason?: string }
): Promise<{ success: boolean; error?: string }> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (contest.status !== "LOCKED" && contest.status !== "PAYOUT_IN_PROGRESS") {
    return { success: false, error: "Only locked contests can be completed" };
  }

  const winners = await prisma.contestWinner.findMany({
    where: { contestId, isAlternate: false },
    include: { entry: true },
  });
  const winnerPubkeys = winners.map((row) => row.entry.authorPubkey);
  const payoutState = normalizeContestPayoutState(
    contest.payoutState,
    winnerPubkeys
  );
  if (!allContestWinnersSettled(payoutState, winnerPubkeys)) {
    const reason = options?.completeOverrideReason?.trim() ?? "";
    if (reason.length < 10) {
      return {
        success: false,
        error: "Settle payouts first or provide 10+ character override reason.",
      };
    }
  }

  await updateContestRow(contestId, {
    status: "COMPLETED",
    completedAt: new Date(),
    eventLogs: {
      create: {
        eventType: "contest_completed",
        message: "Contest completed",
      },
    },
  });
  return { success: true };
}

export async function cancelContest(
  userId: string,
  contestId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (
    contest.status === "LOCKED" ||
    contest.status === "PAYOUT_IN_PROGRESS" ||
    contest.status === "COMPLETED"
  ) {
    return { success: false, error: "Cannot cancel after lock" };
  }
  await updateContestRow(contestId, {
    status: "CANCELLED",
    cancelledAt: new Date(),
    cancellationReason: reason?.trim() || null,
    eventLogs: {
      create: {
        eventType: "contest_cancelled",
        message: "Contest cancelled",
      },
    },
  });
  return { success: true };
}

export async function deleteContest(
  userId: string,
  contestId: string
): Promise<{ success: boolean; error?: string }> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return { success: false, error: "Contest not found" };
  if (
    contest.status === "LOCKED" ||
    contest.status === "PAYOUT_IN_PROGRESS" ||
    contest.status === "COMPLETED"
  ) {
    return { success: false, error: "Cannot delete locked/completed contest" };
  }
  await deleteContestRow(contestId);
  return { success: true };
}

export async function getContestKpiCounts(
  userId: string
): Promise<Partial<Record<string, number>>> {
  const rows = await prisma.contest.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true },
  });
  const map: Partial<Record<string, number>> = {};
  for (const r of rows) {
    map[r.status] = r._count._all;
  }
  return map;
}

export async function getContestEntryCounts(
  userId: string,
  contestIds: string[]
): Promise<Record<string, number>> {
  if (contestIds.length === 0) return {};
  const rows = await prisma.contestEntry.groupBy({
    by: ["contestId"],
    where: {
      contestId: { in: contestIds },
      contest: { userId },
    },
    _count: { _all: true },
  });
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.contestId] = row._count._all;
  }
  return map;
}

export async function listContests(userId: string): Promise<Contest[]> {
  return listContestsByUser(userId);
}

export async function listContestsFiltered(
  userId: string,
  filters: {
    status?: string;
    metric?: string;
    sort?: "newest" | "ending" | "completed";
  }
): Promise<Contest[]> {
  return listContestsByUserWithFilters(userId, filters);
}

export async function duplicateContest(
  userId: string,
  contestId: string
): Promise<{ success: boolean; error?: string; newId?: string }> {
  const c = await getContestById(contestId, userId);
  if (!c) return { success: false, error: "Contest not found" };
  const rankRewardsJson =
    c.prizeMode === "RANKED"
      ? ((c.rankRewards ?? []) as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;
  const newRow = await createContestRow({
    user: { connect: { id: userId } },
    title: c.title ? `${c.title} (copy)` : null,
    sourceNoteId: c.sourceNoteId,
    sourcePostId: c.sourcePostId,
    rankingMetric: c.rankingMetric,
    contestStartAt: null,
    contestEndAt: c.contestEndAt,
    prizeMode: c.prizeMode,
    winnerCount: Math.max(1, Math.min(c.winnerCount, 50)),
    equalRewardSats:
      c.prizeMode === "EQUAL" ? Math.max(0, c.equalRewardSats ?? 0) : null,
    rankRewards: rankRewardsJson,
    fairnessConfig: (c.fairnessConfig ?? undefined) as
      | Prisma.InputJsonValue
      | undefined,
    entryType: c.entryType,
    tieBreakRule: c.tieBreakRule ?? DEFAULT_TIE_BREAK_RULE,
    status: "DRAFT",
    eventLogs: {
      create: {
        eventType: "contest_duplicated",
        message: `Duplicated from contest ${contestId.slice(0, 8)}`,
        metadata: { sourceContestId: contestId } as Prisma.InputJsonValue,
      },
    },
  });
  return { success: true, newId: newRow.id };
}

export async function appendContestEventLog(
  userId: string,
  contestId: string,
  eventType: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const contest = await getContestById(contestId, userId);
  if (!contest) return;
  await prisma.contestEventLog.create({
    data: {
      contestId,
      eventType,
      message,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
/* eslint-enable no-restricted-imports, import/order, sonarjs/no-duplicate-string, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/consistent-type-assertions */
