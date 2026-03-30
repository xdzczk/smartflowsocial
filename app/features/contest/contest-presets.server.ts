import { getUserSubscription } from "~/features/payments/data";
import type { UserSubscription } from "~/features/payments/types";
import {
  getGiveawayPlanLimits,
  getUserPlanType,
} from "~/features/payments/types";

import type { ContestPreset } from "./data/contest-prisma-types.server";
import { Prisma } from "./data/contest-prisma-types.server";
import {
  createContestPresetRow,
  deleteContestPresetRow,
  getContestPresetByIdForUser,
  getContestPresetsByUser,
  updateContestPresetRow,
} from "./repositories/contest-presets-data.server";
import type { ContestRankReward } from "./types";

export interface CreateContestPresetInput {
  name: string;
  title?: string | null;
  rankingMetric: "REACTIONS" | "ZAPS" | "SATS_ZAPPED" | "REPLIES" | "REPOSTS";
  prizeMode: "EQUAL" | "RANKED";
  winnerCount: number;
  equalRewardSats?: number | null;
  rankRewards?: ContestRankReward[] | null;
  fairnessConfig?: Record<string, unknown> | null;
}

export async function createContestPreset(
  userId: string,
  input: CreateContestPresetInput
): Promise<ContestPreset> {
  const subscription = await getUserSubscription(userId);
  const limits = getGiveawayPlanLimits(
    getUserPlanType(subscription as UserSubscription | null)
  );
  if (!limits.canUsePresets) {
    throw new Error(
      "Presets are available on paid plans. Upgrade to save contest presets."
    );
  }

  const winnerCount = Math.max(1, Math.min(50, input.winnerCount));

  return createContestPresetRow({
    user: { connect: { id: userId } },
    name: input.name.trim(),
    title: input.title?.trim() ? input.title.trim() : null,
    rankingMetric: input.rankingMetric,
    prizeMode: input.prizeMode,
    winnerCount,
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
  });
}

export async function deleteContestPreset(
  userId: string,
  id: string
): Promise<void> {
  await deleteContestPresetRow(userId, id);
}

export async function getContestPresetsForUser(
  userId: string
): Promise<ContestPreset[]> {
  return getContestPresetsByUser(userId);
}

export async function getContestPresetById(
  userId: string,
  id: string
): Promise<ContestPreset | null> {
  return getContestPresetByIdForUser(userId, id);
}

export async function touchContestPresetLastUsed(
  userId: string,
  presetId: string
): Promise<void> {
  await updateContestPresetRow(presetId, userId, {
    lastUsedAt: new Date(),
  });
}
