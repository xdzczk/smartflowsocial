/**
 * Giveaway preset CRUD.
 * Presets store scope type, reference, engagement types, winner count, etc.
 * Apply preset: load by id, resolve queue by queueId if present (warn if missing).
 */

import type { UserSubscription } from "~/features/payments/types";
import {
  getUserPlanType,
  getGiveawayPlanLimits,
} from "~/features/payments/types";
import { getUserSubscription } from "~/models/payment.server";

import type {
  GiveawayPreset,
  Prisma,
} from "./data/giveaway-prisma-types.server";
import {
  createGiveawayPreset as createPresetRow,
  deleteGiveawayPreset as deletePresetRow,
  findQueueTypeByIdAndUser,
  getGiveawayPresetById as getPresetByIdRow,
  getGiveawayPresetsByUser as getPresetsByUserRow,
  updateGiveawayPreset as updatePresetRow,
} from "./repositories/giveaway-presets-data.server";

export interface CreateGiveawayPresetInput {
  name: string;
  scopeType: "PERIOD" | "SINGLE_POST" | "QUEUE" | "FOLLOWERS" | "FOLLOWING";
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

  return createPresetRow({
    user: { connect: { id: userId } },
    name: input.name.trim(),
    scopeType: input.scopeType,
    scopeReference: input.scopeReference as Prisma.InputJsonValue,
    engagementTypes: input.engagementTypes as Prisma.InputJsonValue,
    winnerCount: input.winnerCount,
    selectionMode: input.selectionMode ?? "UNIQUE_USER",
    engagementWeights: (input.engagementWeights ?? undefined) as
      | Prisma.InputJsonValue
      | undefined,
    filters: (input.filters ?? undefined) as Prisma.InputJsonValue | undefined,
  });
}

export async function updateGiveawayPreset(
  userId: string,
  id: string,
  input: Partial<CreateGiveawayPresetInput>
): Promise<GiveawayPreset> {
  const data: Prisma.GiveawayPresetUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.scopeType !== undefined) data.scopeType = input.scopeType;
  if (input.scopeReference !== undefined)
    data.scopeReference = input.scopeReference as Prisma.InputJsonValue;
  if (input.engagementTypes !== undefined)
    data.engagementTypes = input.engagementTypes as Prisma.InputJsonValue;
  if (input.winnerCount !== undefined) data.winnerCount = input.winnerCount;
  if (input.selectionMode !== undefined)
    data.selectionMode = input.selectionMode;
  if (input.engagementWeights !== undefined)
    data.engagementWeights = input.engagementWeights as Prisma.InputJsonValue;
  if (input.filters !== undefined)
    data.filters = input.filters as Prisma.InputJsonValue;
  return updatePresetRow(id, userId, data);
}

export async function deleteGiveawayPreset(
  userId: string,
  id: string
): Promise<void> {
  await deletePresetRow(id, userId);
}

export async function getGiveawayPresetsByUser(
  userId: string
): Promise<GiveawayPreset[]> {
  return getPresetsByUserRow(userId);
}

export async function getGiveawayPresetById(
  userId: string,
  id: string
): Promise<GiveawayPreset | null> {
  return getPresetByIdRow(userId, id);
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
  return findQueueTypeByIdAndUser(userId, queueId);
}
