/* eslint-disable no-restricted-imports, import/order, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/consistent-type-assertions -- Contest v1 domain scaffolding will be hardened in follow-up cleanup. */
import { prisma } from "~/lib/prisma.server";

import { Prisma } from "./data/contest-prisma-types.server";
import type { Contest } from "./data/contest-prisma-types.server";
import { DEFAULT_TIE_BREAK_RULE } from "./contest-actions-constants.server";
import { getContestById } from "./contest-actions-queries.server";
import {
  createContest as createContestRow,
  deleteContest as deleteContestRow,
} from "./repositories/contest-actions-data.server";
import type { ContestRankReward } from "./types";

export async function createContest(
  userId: string,
  input: {
    title?: string | null;
    /** Required before launch; may be null while draft awaits linked source publish. */
    sourceNoteId: string | null;
    sourcePostId?: string | null;
    rankingMetric: "REACTIONS" | "ZAPS" | "SATS_ZAPPED" | "REPLIES" | "REPOSTS";
    contestStartAt?: Date | null;
    contestEndAt: Date;
    prizeMode: "EQUAL" | "RANKED";
    winnerCount: number;
    equalRewardSats?: number | null;
    rankRewards?: ContestRankReward[] | null;
    fairnessConfig?: Record<string, unknown> | null;
    /** Draft default; use SCHEDULED_LAUNCH when activation is deferred. */
    status?: "DRAFT" | "SCHEDULED_LAUNCH";
  }
): Promise<Contest> {
  return createContestRow({
    user: { connect: { id: userId } },
    title: input.title?.trim() || null,
    sourceNoteId: input.sourceNoteId?.trim() ? input.sourceNoteId.trim() : null,
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
    status: input.status ?? "DRAFT",
    eventLogs: {
      create: {
        eventType: "contest_created",
        message: "Contest created as draft",
      },
    },
  });
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
    fairnessConfig: c.fairnessConfig ?? undefined,
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
/* eslint-enable no-restricted-imports, import/order, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/consistent-type-assertions */
