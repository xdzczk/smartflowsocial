import { getUserSubscription } from "~/features/payments/data";
import type { UserSubscription } from "~/features/payments/types";
import {
  getGiveawayPlanLimits,
  getUserPlanType,
} from "~/features/payments/types";

import { Prisma } from "./data/giveaway-prisma-types.server";
import type {
  Giveaway,
  GiveawaySelectionMode,
} from "./data/giveaway-prisma-types.server";
import {
  DEFAULT_ENGAGEMENT_TYPES,
  ERROR_GIVEAWAY_NOT_FOUND,
} from "./giveaway-actions-shared.server";
import { appendGiveawayActivityLog } from "./giveaway-activity-log.server";
import {
  createGiveaway as createGiveawayRow,
  deleteGiveawayById,
  findGiveawayByIdAndUser,
  listGiveawaysByUser as listGiveawaysByUserFromRepo,
  updateGiveaway as updateGiveawayRow,
} from "./repositories/giveaway-actions-data.server";
import {
  isSimpleUnifiedEngagementConfig,
  scopeAllowsEngagementEntryTypePick,
  scopeIsFollowGraphAccountPool,
  type GiveawayEngagementConfig,
  type SimpleUnifiedEngagementConfig,
} from "./types";

export async function getGiveawayById(
  id: string,
  userId: string
): Promise<Giveaway | null> {
  return findGiveawayByIdAndUser(id, userId);
}

export interface CreateGiveawayInput {
  name?: string | null;
  scopeType: "PERIOD" | "SINGLE_POST" | "QUEUE" | "FOLLOWERS" | "FOLLOWING";
  scopeReference: Record<string, unknown>;
  eligibilityFrom?: Date | null;
  eligibilityTo?: Date | null;
  engagementTypes: string[];
  winnerCount: number;
  /** Per-type rewards (advanced), or `_simpleUnified` for simple payout mode. */
  engagementConfig?:
    | GiveawayEngagementConfig
    | SimpleUnifiedEngagementConfig
    | null;
  selectionMode?: GiveawaySelectionMode;
  engagementWeights?: Record<string, number> | null;
  filters?: Record<string, unknown> | null;
}

export async function createGiveaway(
  userId: string,
  input: CreateGiveawayInput
): Promise<Giveaway> {
  const subscription = await getUserSubscription(userId);
  const planType = getUserPlanType(subscription as UserSubscription | null);
  const limits = getGiveawayPlanLimits(planType);

  const hasQueueFilter =
    input.scopeType === "QUEUE" ||
    (input.scopeType === "PERIOD" &&
      typeof input.scopeReference["queueId"] === "string" &&
      input.scopeReference["queueId"].trim() !== "");
  if (hasQueueFilter && !limits.canUseQueueScope) {
    throw new Error(
      "Queue filter is available on paid plans. Upgrade to limit giveaway to a specific queue."
    );
  }

  let winnerCount = Math.min(input.winnerCount, limits.maxWinnerCount);
  if (
    !scopeIsFollowGraphAccountPool(input.scopeType) &&
    !isSimpleUnifiedEngagementConfig(input.engagementConfig) &&
    input.engagementConfig &&
    typeof input.engagementConfig === "object" &&
    Object.keys(input.engagementConfig).length > 0
  ) {
    const sum = Object.values(input.engagementConfig).reduce(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- engagementConfig entries may omit winnerCount
      (acc, c) => acc + (c.winnerCount ?? 0),
      0
    );
    winnerCount = Math.min(sum, limits.maxWinnerCount);
  }

  const engagementTypesStored = scopeIsFollowGraphAccountPool(input.scopeType)
    ? []
    : scopeAllowsEngagementEntryTypePick(input.scopeType)
      ? input.engagementTypes
      : [...DEFAULT_ENGAGEMENT_TYPES];

  const engagementConfigStored =
    !input.engagementConfig ||
    typeof input.engagementConfig !== "object" ||
    Object.keys(input.engagementConfig).length === 0
      ? undefined
      : input.engagementConfig;

  const plannedPayoutSats =
    isSimpleUnifiedEngagementConfig(engagementConfigStored) &&
    scopeIsFollowGraphAccountPool(input.scopeType)
      ? Math.max(
          0,
          Math.floor(engagementConfigStored._simpleUnified.satsPerWinner) *
            Math.max(0, Math.floor(winnerCount))
        )
      : undefined;

  const selectionModeStored = scopeIsFollowGraphAccountPool(input.scopeType)
    ? "UNIQUE_USER"
    : (input.selectionMode ?? "UNIQUE_USER");

  return createGiveawayRow(userId, {
    user: { connect: { id: userId } },
    name: (input.name?.trim() ?? "") || undefined,
    scopeType: input.scopeType,
    scopeReference: input.scopeReference as Prisma.InputJsonValue,
    eligibilityFrom: input.eligibilityFrom ?? undefined,
    eligibilityTo: input.eligibilityTo ?? undefined,
    engagementTypes: engagementTypesStored as Prisma.InputJsonValue,
    winnerCount,
    engagementConfig:
      engagementConfigStored && Object.keys(engagementConfigStored).length > 0
        ? (engagementConfigStored as Prisma.InputJsonValue)
        : undefined,
    selectionMode: selectionModeStored,
    engagementWeights: scopeIsFollowGraphAccountPool(input.scopeType)
      ? undefined
      : ((input.engagementWeights ?? undefined) as
          | Prisma.InputJsonValue
          | undefined),
    filters: (input.filters ?? undefined) as Prisma.InputJsonValue | undefined,
    plannedPayoutSats,
    status: "DRAFT",
    activityLog: appendGiveawayActivityLog(null, "giveaway_created"),
  });
}

export interface UpdateGiveawayInput {
  name?: string | null;
  winnerCount?: number;
  engagementTypes?: string[];
  engagementConfig?:
    | GiveawayEngagementConfig
    | SimpleUnifiedEngagementConfig
    | null;
  selectionMode?: GiveawaySelectionMode;
}

/** Update giveaway config; only allowed when status is DRAFT. */
export async function updateGiveaway(
  userId: string,
  giveawayId: string,
  input: UpdateGiveawayInput
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "DRAFT") {
    return { success: false, error: "Only draft giveaways can be edited" };
  }

  const subscription = await getUserSubscription(userId);
  const planType = getUserPlanType(subscription as UserSubscription | null);
  const limits = getGiveawayPlanLimits(planType);

  const data: Prisma.GiveawayUpdateInput = {};
  if (input.name !== undefined) data.name = input.name?.trim() ?? null;
  if (input.winnerCount !== undefined) {
    data.winnerCount = Math.min(
      Math.max(1, Math.floor(input.winnerCount)),
      limits.maxWinnerCount
    );
  }
  if (scopeAllowsEngagementEntryTypePick(g.scopeType)) {
    if (input.engagementTypes !== undefined) {
      if (
        !Array.isArray(input.engagementTypes) ||
        input.engagementTypes.length === 0
      ) {
        return {
          success: false,
          error: "At least one engagement type required",
        };
      }
      data.engagementTypes = input.engagementTypes;
    }
  } else if (scopeIsFollowGraphAccountPool(g.scopeType)) {
    data.engagementTypes = [];
    data.engagementConfig = Prisma.JsonNull;
    data.selectionMode = "UNIQUE_USER";
    data.engagementWeights = Prisma.JsonNull;
  } else {
    data.engagementTypes = [...DEFAULT_ENGAGEMENT_TYPES];
  }
  if (
    !scopeIsFollowGraphAccountPool(g.scopeType) &&
    input.engagementConfig !== undefined
  ) {
    data.engagementConfig =
      input.engagementConfig && Object.keys(input.engagementConfig).length > 0
        ? (input.engagementConfig as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    if (
      input.engagementConfig &&
      Object.keys(input.engagementConfig).length > 0 &&
      !isSimpleUnifiedEngagementConfig(input.engagementConfig)
    ) {
      const sum = Object.values(input.engagementConfig).reduce(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- engagementConfig entries may omit winnerCount
        (acc, c) => acc + (c.winnerCount ?? 0),
        0
      );
      data.winnerCount = Math.min(
        Math.max(1, Math.floor(sum)),
        limits.maxWinnerCount
      );
    }
  }
  if (
    !scopeIsFollowGraphAccountPool(g.scopeType) &&
    input.selectionMode !== undefined
  ) {
    data.selectionMode = input.selectionMode;
  }

  if (Object.keys(data).length === 0) {
    return { success: true };
  }

  data.activityLog = appendGiveawayActivityLog(
    g.activityLog,
    "configuration_updated"
  );

  await updateGiveawayRow(giveawayId, data);
  return { success: true };
}

/** Delete a giveaway permanently. Only allowed for DRAFT, PREVIEWED, or CANCELLED. */
export async function deleteGiveaway(
  userId: string,
  giveawayId: string
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status === "LOCKED" || g.status === "PAID_OUT")
    return {
      success: false,
      error: "Cannot delete locked or paid-out giveaway",
    };

  await deleteGiveawayById(giveawayId);
  return { success: true };
}

export async function duplicateGiveaway(
  userId: string,
  giveawayId: string
): Promise<{ id: string | null; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { id: null, error: ERROR_GIVEAWAY_NOT_FOUND };
  const created = await createGiveaway(userId, {
    name: g.name ? `${g.name} (copy)` : `Giveaway copy ${g.id.slice(0, 6)}`,
    scopeType: g.scopeType,
    scopeReference: g.scopeReference as Record<string, unknown>,
    eligibilityFrom: g.eligibilityFrom ?? undefined,
    eligibilityTo: g.eligibilityTo ?? undefined,
    engagementTypes: g.engagementTypes as string[],
    winnerCount: g.winnerCount,
    engagementConfig: g.engagementConfig as GiveawayEngagementConfig | null,
    selectionMode: g.selectionMode,
    engagementWeights: g.engagementWeights as Record<string, number> | null,
    filters: g.filters as Record<string, unknown> | null,
  });
  return { id: created.id };
}

export async function listGiveawaysByUser(
  userId: string,
  options?: { status?: Giveaway["status"] }
): Promise<Giveaway[]> {
  return listGiveawaysByUserFromRepo(userId, options);
}
