/**
 * Giveaway preset CRUD.
 * Presets store scope type, reference, engagement types, winner count, etc.
 * Apply preset: load by id, resolve queue by queueId if present (warn if missing).
 */

import type { GiveawayPreset } from "@prisma/client";

import type { UserSubscription } from "~/features/payments/types";
import {
  getUserPlanType,
  getGiveawayPlanLimits,
} from "~/features/payments/types";
import { prisma } from "~/lib/prisma.server";
import { getUserSubscription } from "~/models/payment.server";

export interface CreateGiveawayPresetInput {
  name: string;
  scopeType: "PERIOD" | "SINGLE_POST" | "QUEUE";
  scopeReference: Record<string, unknown>;
  engagementTypes: string[];
  winnerCount: number;
  selectionMode?: "UNIQUE_USER" | "WEIGHTED_BY_ENGAGEMENT";
  engagementWeights?: Record<string, number> | null;
  filters?: Record<string, unknown> | null;
}

export async function createGiveawayPreset(
  userId: string,
  input: CreateGiveawayPresetInput
): Promise<GiveawayPreset> {
  const subscription = await getUserSubscription(userId);
  const limits = getGiveawayPlanLimits(
    getUserPlanType(subscription as UserSubscription | null)
  );
  if (!limits.canUsePresets) {
    throw new Error(
      "Presets are available on paid plans. Upgrade to save giveaway presets."
    );
  }

  return prisma.giveawayPreset.create({
    data: {
      userId,
      name: input.name.trim(),
      scopeType: input.scopeType,
      scopeReference: input.scopeReference,
      engagementTypes: input.engagementTypes,
      winnerCount: input.winnerCount,
      selectionMode: input.selectionMode ?? "UNIQUE_USER",
      engagementWeights: input.engagementWeights ?? undefined,
      filters: input.filters ?? undefined,
    },
  });
}

export async function updateGiveawayPreset(
  userId: string,
  id: string,
  input: Partial<CreateGiveawayPresetInput>
): Promise<GiveawayPreset> {
  const data: Parameters<typeof prisma.giveawayPreset.update>[0]["data"] = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.scopeType !== undefined) data.scopeType = input.scopeType;
  if (input.scopeReference !== undefined)
    data.scopeReference = input.scopeReference;
  if (input.engagementTypes !== undefined)
    data.engagementTypes = input.engagementTypes;
  if (input.winnerCount !== undefined) data.winnerCount = input.winnerCount;
  if (input.selectionMode !== undefined)
    data.selectionMode = input.selectionMode;
  if (input.engagementWeights !== undefined)
    data.engagementWeights = input.engagementWeights as Parameters<
      typeof prisma.giveawayPreset.update
    >[0]["data"]["engagementWeights"];
  if (input.filters !== undefined)
    data.filters = input.filters as Parameters<
      typeof prisma.giveawayPreset.update
    >[0]["data"]["filters"];
  return prisma.giveawayPreset.update({
    where: { id, userId },
    data,
  });
}

export async function deleteGiveawayPreset(
  userId: string,
  id: string
): Promise<void> {
  await prisma.giveawayPreset.delete({
    where: { id, userId },
  });
}

export async function getGiveawayPresetsByUser(
  userId: string
): Promise<GiveawayPreset[]> {
  return prisma.giveawayPreset.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getGiveawayPresetById(
  userId: string,
  id: string
): Promise<GiveawayPreset | null> {
  return prisma.giveawayPreset.findFirst({
    where: { id, userId },
  });
}

/**
 * Resolve queue id from preset scopeReference to queue name/id for display.
 * Returns null if queue was deleted (caller should show warning).
 */
export async function resolvePresetQueue(
  userId: string,
  scopeReference: Record<string, unknown>
): Promise<{ id: string; name: string } | null> {
  const queueId = scopeReference["queueId"];
  if (typeof queueId !== "string") return null;
  return await prisma.queueType.findFirst({
    where: { id: queueId, userId },
    select: { id: true, name: true },
  });
}
