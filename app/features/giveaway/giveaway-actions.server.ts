/**
 * Giveaway CRUD and lifecycle actions: create, preview, reroll, exclude, lock, cancel, markPaidOut.
 */

import type { Giveaway, GiveawaySelectionMode } from "@prisma/client";

import type { UserSubscription } from "~/features/payments/types";
import {
  getUserPlanType,
  getGiveawayPlanLimits,
} from "~/features/payments/types";
import { getUserById } from "~/features/user";
import { prisma } from "~/lib/prisma.server";
import { getUserSubscription } from "~/models/payment.server";

import {
  processGiveawayParticipants,
  type GiveawayParticipantFilters,
} from "./giveaway-loader.server";
import { getPostsInScope } from "./giveaway-scope.server";
import { runGiveawaySelection } from "./giveaway-selection.server";
import { fetchGiveawayParticipants } from "./giveaway.server";
import type {
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
    default:
      return { type: "PERIOD", reference: { days: 7 } };
  }
}

async function getEligibleParticipantsForGiveaway(
  userId: string,
  g: Giveaway
): Promise<{ relatedEvents: RelatedEvent[] }> {
  const scope = scopeFromGiveaway(g);
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
  const processed = await processGiveawayParticipants(
    relatedEvents,
    userId,
    userWithDefaults,
    filters ? { filters } : undefined
  );
  return { relatedEvents: processed };
}

export async function getGiveawayById(
  id: string,
  userId: string
): Promise<Giveaway | null> {
  return prisma.giveaway.findFirst({
    where: { id, userId },
  });
}

export interface CreateGiveawayInput {
  name?: string | null;
  scopeType: "PERIOD" | "SINGLE_POST" | "QUEUE";
  scopeReference: Record<string, unknown>;
  eligibilityFrom?: Date | null;
  eligibilityTo?: Date | null;
  engagementTypes: string[];
  winnerCount: number;
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

  if (input.scopeType === "QUEUE" && !limits.canUseQueueScope) {
    throw new Error(
      "Queue scope is available on paid plans. Upgrade to create giveaways for a specific queue."
    );
  }

  const winnerCount = Math.min(input.winnerCount, limits.maxWinnerCount);

  return prisma.giveaway.create({
    data: {
      userId,
      name: (input.name?.trim() ?? "") || undefined,
      scopeType: input.scopeType,
      scopeReference: input.scopeReference,
      eligibilityFrom: input.eligibilityFrom ?? undefined,
      eligibilityTo: input.eligibilityTo ?? undefined,
      engagementTypes: input.engagementTypes,
      winnerCount,
      selectionMode: input.selectionMode ?? "UNIQUE_USER",
      engagementWeights: input.engagementWeights ?? undefined,
      filters: input.filters ?? undefined,
      status: "DRAFT",
    },
  });
}

export interface UpdateGiveawayInput {
  name?: string | null;
  winnerCount?: number;
  engagementTypes?: string[];
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

  const data: Parameters<typeof prisma.giveaway.update>[0]["data"] = {};
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
  if (input.selectionMode !== undefined) {
    data.selectionMode = input.selectionMode;
  }

  await prisma.giveaway.update({
    where: { id: giveawayId },
    data,
  });
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
  const engagementTypes =
    g.engagementTypes as string[] as GiveawayEngagementType[];
  const weights = g.engagementWeights as Record<string, number> | undefined;
  const winners = runGiveawaySelection({
    relatedEvents,
    engagementTypes: engagementTypes.length
      ? engagementTypes
      : DEFAULT_ENGAGEMENT_TYPES,
    selectionMode: g.selectionMode,
    engagementWeights: weights,
    winnerCount: g.winnerCount,
  });

  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: {
      status: "PREVIEWED",
      winnerSnapshot: winners as unknown as Array<Record<string, unknown>>,
    },
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
  const engagementTypes =
    g.engagementTypes as string[] as GiveawayEngagementType[];
  const weights = g.engagementWeights as Record<string, number> | undefined;
  const winners = runGiveawaySelection({
    relatedEvents,
    engagementTypes: engagementTypes.length
      ? engagementTypes
      : DEFAULT_ENGAGEMENT_TYPES,
    selectionMode: g.selectionMode,
    engagementWeights: weights,
    winnerCount: g.winnerCount,
  });

  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: {
      winnerSnapshot: winners as unknown as Array<Record<string, unknown>>,
    },
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
  const engagementTypes =
    g.engagementTypes as string[] as GiveawayEngagementType[];
  const weights = g.engagementWeights as Record<string, number> | undefined;
  const excludedPubkeys = new Set(without.map((w) => w.pubkey));
  const eligibleEvents = relatedEvents.filter(
    (e) => !excludedPubkeys.has(e.pubkey)
  );
  const newWinners = runGiveawaySelection({
    relatedEvents: eligibleEvents,
    engagementTypes: engagementTypes.length
      ? engagementTypes
      : DEFAULT_ENGAGEMENT_TYPES,
    selectionMode: g.selectionMode,
    engagementWeights: weights,
    winnerCount: 1,
  });
  const updated = [...without, ...newWinners].slice(0, g.winnerCount);

  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: {
      winnerSnapshot: updated as unknown as Array<Record<string, unknown>>,
    },
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

  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: { status: "LOCKED", lockedAt: new Date() },
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

  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: { status: "CANCELLED" },
  });
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

  await prisma.giveaway.delete({
    where: { id: giveawayId },
  });
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

  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: { status: "PAID_OUT" },
  });
  return { success: true };
}

export async function listGiveawaysByUser(
  userId: string,
  options?: { status?: Giveaway["status"] }
): Promise<Giveaway[]> {
  return prisma.giveaway.findMany({
    where: {
      userId,
      ...(options?.status !== undefined && { status: options.status }),
    },
    orderBy: { createdAt: "desc" },
  });
}
