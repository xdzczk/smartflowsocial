/**
 * Giveaway CRUD and lifecycle actions: create, preview, reroll, exclude, lock, cancel, markPaidOut.
 */

import { getUserSubscription } from "~/features/payments/data";
import type { UserSubscription } from "~/features/payments/types";
import {
  getUserPlanType,
  getGiveawayPlanLimits,
} from "~/features/payments/types";
import { getUserById } from "~/features/user";

import { Prisma } from "./data/giveaway-prisma-types.server";
import type {
  Giveaway,
  GiveawaySelectionMode,
} from "./data/giveaway-prisma-types.server";
import {
  getParticipantPubkeysForFollowScope,
  processGiveawayParticipants,
  type GiveawayParticipantFilters,
} from "./giveaway-loader.server";
import { getPostsInScope } from "./giveaway-scope.server";
import {
  runGiveawaySelection,
  runGiveawaySelectionPerEngagement,
} from "./giveaway-selection.server";
import { fetchGiveawayParticipants } from "./giveaway.server";
import {
  createGiveaway as createGiveawayRow,
  deleteGiveawayById,
  findGiveawayByIdAndUser,
  listGiveawaysByUser as listGiveawaysByUserFromRepo,
  updateGiveaway as updateGiveawayRow,
} from "./repositories/giveaway-actions-data.server";
import type {
  GiveawayEngagementConfig,
  GiveawayEngagementType,
  GiveawayScope,
  GiveawayWinnerEntry,
  RelatedEvent,
} from "./types";

const DEFAULT_ENGAGEMENT_TYPES: GiveawayEngagementType[] = [
  "REACTION",
  "REPOST",
  "COMMENT",
  "ZAP",
];

const ERROR_GIVEAWAY_NOT_FOUND = "Giveaway not found";

/** Build GiveawayScope from persisted Giveaway (scopeType + scopeReference). */
function scopeFromGiveaway(g: Giveaway): GiveawayScope {
  const ref = g.scopeReference as Record<string, unknown>;
  switch (g.scopeType) {
    case "PERIOD":
      return {
        type: "PERIOD",
        reference: {
          days: typeof ref["days"] === "number" ? ref["days"] : 7,
          from: ref["from"] ? new Date(ref["from"] as string) : undefined,
          to: ref["to"] ? new Date(ref["to"] as string) : undefined,
          queueId:
            typeof ref["queueId"] === "string" && ref["queueId"].trim()
              ? ref["queueId"]
              : undefined,
        },
      };
    case "SINGLE_POST":
      return {
        type: "SINGLE_POST",
        reference: { postId: String(ref["postId"] ?? "") },
      };
    case "QUEUE":
      return {
        type: "QUEUE",
        reference: {
          queueId: String(ref["queueId"] ?? ""),
          from: ref["from"] ? new Date(ref["from"] as string) : undefined,
          to: ref["to"] ? new Date(ref["to"] as string) : undefined,
        },
      };
    case "FOLLOWERS":
      return { type: "FOLLOWERS", reference: {} };
    case "FOLLOWING":
      return { type: "FOLLOWING", reference: {} };
    default:
      return { type: "PERIOD", reference: { days: 7 } };
  }
}

/** Build minimal RelatedEvent per pubkey for follow-scope giveaways (kind 7 so they pass engagement filter). */
function relatedEventsFromPubkeys(pubkeys: string[]): RelatedEvent[] {
  return pubkeys.map((pubkey, i) => ({
    id: `follow-${pubkey}-${i}`,
    pubkey,
    created_at: 0,
    kind: 7,
  }));
}

async function getEligibleParticipantsForGiveaway(
  userId: string,
  g: Giveaway
): Promise<{ relatedEvents: RelatedEvent[] }> {
  const scope = scopeFromGiveaway(g);
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const userWithDefaults = {
    ...user,
    id: user.id,
    npub: user.npub,
    filterMuted: user.filterMuted,
    mutedList:
      user.mutedList &&
      typeof user.mutedList === "object" &&
      !Array.isArray(user.mutedList) &&
      "npubs" in user.mutedList
        ? {
            npubs: Array.isArray((user.mutedList as { npubs?: unknown }).npubs)
              ? ((user.mutedList as { npubs?: unknown }).npubs as string[])
              : [],
          }
        : { npubs: [] },
  };
  const filters = g.filters as GiveawayParticipantFilters | undefined;

  if (scope.type === "FOLLOWERS" || scope.type === "FOLLOWING") {
    const pubkeys = await getParticipantPubkeysForFollowScope(
      userId,
      scope,
      user.npub
    );
    const relatedEvents = relatedEventsFromPubkeys(pubkeys);
    const processed = await processGiveawayParticipants(
      relatedEvents,
      userId,
      userWithDefaults,
      filters ? { filters } : undefined
    );
    return { relatedEvents: processed };
  }

  const posts = await getPostsInScope(userId, scope);
  const eventIds = posts
    .filter(
      (p) =>
        p.signedEvent &&
        typeof p.signedEvent === "object" &&
        "id" in p.signedEvent
    )
    .map((p) => (p.signedEvent as { id: string }).id);
  if (eventIds.length === 0) {
    return { relatedEvents: [] };
  }
  const { relatedEvents } = await fetchGiveawayParticipants(eventIds);
  const processed = await processGiveawayParticipants(
    relatedEvents,
    userId,
    userWithDefaults,
    filters ? { filters } : undefined
  );
  return { relatedEvents: processed };
}

function runSelectionForGiveaway(
  g: Giveaway,
  relatedEvents: RelatedEvent[]
): GiveawayWinnerEntry[] {
  const engagementConfig =
    g.engagementConfig as GiveawayEngagementConfig | null;
  const engagementTypes =
    g.engagementTypes as string[] as GiveawayEngagementType[];
  const types = engagementTypes.length
    ? engagementTypes
    : DEFAULT_ENGAGEMENT_TYPES;
  const weights = g.engagementWeights as Record<string, number> | undefined;

  if (
    engagementConfig &&
    typeof engagementConfig === "object" &&
    Object.keys(engagementConfig).length > 0
  ) {
    return runGiveawaySelectionPerEngagement({
      relatedEvents,
      engagementConfig,
      selectionMode: g.selectionMode,
      engagementWeights: weights,
    });
  }

  return runGiveawaySelection({
    relatedEvents,
    engagementTypes: types,
    selectionMode: g.selectionMode,
    engagementWeights: weights,
    winnerCount: g.winnerCount,
  });
}

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
  /** When set, per-engagement winner counts and sats; winnerCount becomes sum of counts. */
  engagementConfig?: GiveawayEngagementConfig | null;
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

  return createGiveawayRow(userId, {
    user: { connect: { id: userId } },
    name: (input.name?.trim() ?? "") || undefined,
    scopeType: input.scopeType,
    scopeReference: input.scopeReference as Prisma.InputJsonValue,
    eligibilityFrom: input.eligibilityFrom ?? undefined,
    eligibilityTo: input.eligibilityTo ?? undefined,
    engagementTypes: input.engagementTypes as Prisma.InputJsonValue,
    winnerCount,
    engagementConfig:
      input.engagementConfig && Object.keys(input.engagementConfig).length > 0
        ? (input.engagementConfig as Prisma.InputJsonValue)
        : undefined,
    selectionMode: input.selectionMode ?? "UNIQUE_USER",
    engagementWeights: (input.engagementWeights ?? undefined) as
      | Prisma.InputJsonValue
      | undefined,
    filters: (input.filters ?? undefined) as Prisma.InputJsonValue | undefined,
    status: "DRAFT",
  });
}

export interface UpdateGiveawayInput {
  name?: string | null;
  winnerCount?: number;
  engagementTypes?: string[];
  engagementConfig?: GiveawayEngagementConfig | null;
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
  if (input.engagementTypes !== undefined) {
    if (
      !Array.isArray(input.engagementTypes) ||
      input.engagementTypes.length === 0
    ) {
      return { success: false, error: "At least one engagement type required" };
    }
    data.engagementTypes = input.engagementTypes;
  }
  if (input.engagementConfig !== undefined) {
    data.engagementConfig =
      input.engagementConfig && Object.keys(input.engagementConfig).length > 0
        ? (input.engagementConfig as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    if (
      input.engagementConfig &&
      Object.keys(input.engagementConfig).length > 0
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
  if (input.selectionMode !== undefined) {
    data.selectionMode = input.selectionMode;
  }

  await updateGiveawayRow(giveawayId, data);
  return { success: true };
}

export async function previewGiveaway(
  userId: string,
  giveawayId: string
): Promise<{ winners: GiveawayWinnerEntry[]; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { winners: [], error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "DRAFT" && g.status !== "PREVIEWED")
    return { winners: [], error: "Giveaway cannot be previewed" };

  const { relatedEvents } = await getEligibleParticipantsForGiveaway(userId, g);
  const winners = runSelectionForGiveaway(g, relatedEvents);

  await updateGiveawayRow(giveawayId, {
    status: "PREVIEWED",
    winnerSnapshot: winners as unknown as Prisma.InputJsonValue,
  });

  return { winners };
}

export async function rerollGiveaway(
  userId: string,
  giveawayId: string
): Promise<{ winners: GiveawayWinnerEntry[]; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { winners: [], error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "PREVIEWED")
    return { winners: [], error: "Only previewed giveaways can be rerolled" };

  const { relatedEvents } = await getEligibleParticipantsForGiveaway(userId, g);
  const winners = runSelectionForGiveaway(g, relatedEvents);

  await updateGiveawayRow(giveawayId, {
    winnerSnapshot: winners as unknown as Prisma.InputJsonValue,
  });

  return { winners };
}

export async function excludeWinnerAndRedraw(
  userId: string,
  giveawayId: string,
  winnerPubkey: string
): Promise<{ winners: GiveawayWinnerEntry[]; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { winners: [], error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "PREVIEWED")
    return { winners: [], error: "Only previewed giveaways can be modified" };

  const current = (g.winnerSnapshot as GiveawayWinnerEntry[] | null) ?? [];
  const without = current.filter((w) => w.pubkey !== winnerPubkey);
  if (without.length === current.length)
    return { winners: current, error: "Winner not in list" };

  const { relatedEvents } = await getEligibleParticipantsForGiveaway(userId, g);
  const excludedPubkeys = new Set(without.map((w) => w.pubkey));
  const eligibleEvents = relatedEvents.filter(
    (e) => !excludedPubkeys.has(e.pubkey)
  );
  const updated = runSelectionForGiveaway(g, eligibleEvents);

  await updateGiveawayRow(giveawayId, {
    winnerSnapshot: updated as unknown as Prisma.InputJsonValue,
  });

  return { winners: updated };
}

export async function lockGiveaway(
  userId: string,
  giveawayId: string
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "PREVIEWED")
    return { success: false, error: "Only previewed giveaways can be locked" };
  const snapshot = g.winnerSnapshot as GiveawayWinnerEntry[] | null;
  if (!snapshot?.length) return { success: false, error: "No winners to lock" };

  await updateGiveawayRow(giveawayId, {
    status: "LOCKED",
    lockedAt: new Date(),
  });
  return { success: true };
}

export async function cancelGiveaway(
  userId: string,
  giveawayId: string
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status === "LOCKED" || g.status === "PAID_OUT")
    return { success: false, error: "Cannot cancel locked or paid giveaway" };

  await updateGiveawayRow(giveawayId, { status: "CANCELLED" });
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

export async function markGiveawayPaidOut(
  userId: string,
  giveawayId: string
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "LOCKED")
    return {
      success: false,
      error: "Only locked giveaways can be marked paid",
    };

  await updateGiveawayRow(giveawayId, { status: "PAID_OUT" });
  return { success: true };
}

export async function listGiveawaysByUser(
  userId: string,
  options?: { status?: Giveaway["status"] }
): Promise<Giveaway[]> {
  return listGiveawaysByUserFromRepo(userId, options);
}
