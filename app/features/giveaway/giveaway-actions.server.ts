/**
 * Giveaway CRUD and lifecycle actions: create, preview, reroll, exclude, lock, cancel, markPaidOut.
 */

import { getUserSubscription } from "~/features/payments/data";
import type { UserSubscription } from "~/features/payments/types";
import {
  getGiveawayPlanLimits,
  getPlanDisplayName,
  getUserPlanType,
} from "~/features/payments/types";
import { getUserById } from "~/features/user";

import { Prisma } from "./data/giveaway-prisma-types.server";
import type {
  Giveaway,
  GiveawaySelectionMode,
} from "./data/giveaway-prisma-types.server";
import { appendGiveawayActivityLog } from "./giveaway-activity-log.server";
import { quoteGiveawayFinalization } from "./giveaway-finalization-fee.server";
import {
  getParticipantPubkeysForFollowScope,
  processGiveawayParticipants,
  type GiveawayParticipantFilters,
} from "./giveaway-loader.server";
import {
  allWinnersPayoutSettled,
  buildInitialPayoutState,
  normalizePayoutState,
} from "./giveaway-payout.server";
import type { GiveawayPayoutEntryStatus } from "./giveaway-payout.server";
import { getPostsInScope } from "./giveaway-scope.server";
import {
  runGiveawayAccountPoolSelection,
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
import { findPaidFinalizationForLock } from "./repositories/giveaway-finalization-payment.server";
import {
  ALL_GIVEAWAY_ENGAGEMENT_TYPES,
  scopeAllowsEngagementEntryTypePick,
  scopeIsFollowGraphAccountPool,
  type GiveawayEngagementConfig,
  type GiveawayEngagementType,
  type GiveawayScope,
  type GiveawayWinnerEntry,
  type RelatedEvent,
} from "./types";

const DEFAULT_ENGAGEMENT_TYPES: GiveawayEngagementType[] = [
  ...ALL_GIVEAWAY_ENGAGEMENT_TYPES,
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
  const scope = scopeFromGiveaway(g);
  if (scope.type === "FOLLOWERS" || scope.type === "FOLLOWING") {
    return runGiveawayAccountPoolSelection(relatedEvents, g.winnerCount);
  }

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
    !scopeIsFollowGraphAccountPool(input.scopeType) &&
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
    scopeIsFollowGraphAccountPool(input.scopeType) ||
    !input.engagementConfig ||
    typeof input.engagementConfig !== "object" ||
    Object.keys(input.engagementConfig).length === 0
      ? undefined
      : input.engagementConfig;

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
    status: "DRAFT",
    activityLog: appendGiveawayActivityLog(null, "giveaway_created"),
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

  const lastPreviewMeta = {
    eligiblePoolSize: relatedEvents.length,
    computedAt: new Date().toISOString(),
    selectionMode: g.selectionMode,
    filters: g.filters ?? null,
  };

  await updateGiveawayRow(giveawayId, {
    status: "PREVIEWED",
    winnerSnapshot: winners as unknown as Prisma.InputJsonValue,
    lastPreviewMeta: lastPreviewMeta as unknown as Prisma.InputJsonValue,
    activityLog: appendGiveawayActivityLog(g.activityLog, "preview_generated", {
      eligiblePoolSize: relatedEvents.length,
      winnersDrawn: winners.length,
    }),
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

  const lastPreviewMeta = {
    eligiblePoolSize: relatedEvents.length,
    computedAt: new Date().toISOString(),
    selectionMode: g.selectionMode,
    filters: g.filters ?? null,
  };

  await updateGiveawayRow(giveawayId, {
    winnerSnapshot: winners as unknown as Prisma.InputJsonValue,
    lastPreviewMeta: lastPreviewMeta as unknown as Prisma.InputJsonValue,
    rerollCount: { increment: 1 },
    activityLog: appendGiveawayActivityLog(g.activityLog, "rerolled", {
      eligiblePoolSize: relatedEvents.length,
    }),
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
  const keepWinnerKeys = new Set(without.map((w) => w.pubkey));
  const eligibleEvents = relatedEvents.filter(
    (e) => !keepWinnerKeys.has(e.pubkey)
  );
  const updated = runSelectionForGiveaway(g, eligibleEvents);

  const prevEx =
    Array.isArray(g.excludedPubkeys) &&
    g.excludedPubkeys.every((x) => typeof x === "string")
      ? g.excludedPubkeys
      : [];
  const excludedHistory = [...new Set([...prevEx, winnerPubkey])];

  const lastPreviewMeta = {
    eligiblePoolSize: eligibleEvents.length,
    computedAt: new Date().toISOString(),
    selectionMode: g.selectionMode,
    filters: g.filters ?? null,
  };

  await updateGiveawayRow(giveawayId, {
    winnerSnapshot: updated as unknown as Prisma.InputJsonValue,
    lastPreviewMeta: lastPreviewMeta as unknown as Prisma.InputJsonValue,
    excludedPubkeys: excludedHistory as unknown as Prisma.InputJsonValue,
    rerollCount: { increment: 1 },
    activityLog: appendGiveawayActivityLog(g.activityLog, "winner_excluded", {
      excludedPubkey: winnerPubkey,
    }),
  });

  return { winners: updated };
}

export async function lockGiveaway(
  userId: string,
  giveawayId: string,
  options?: { lockConfigHash?: string }
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };

  if (g.status === "LOCKED") {
    return { success: true };
  }

  if (g.status !== "PREVIEWED") {
    return { success: false, error: "Only previewed giveaways can be locked" };
  }

  const snapshot = g.winnerSnapshot as GiveawayWinnerEntry[] | null;
  if (!snapshot?.length) return { success: false, error: "No winners to lock" };

  const subscription = await getUserSubscription(userId);
  const planType = getUserPlanType(subscription as UserSubscription | null);
  const quote = quoteGiveawayFinalization({
    giveaway: {
      winnerSnapshot: g.winnerSnapshot,
      engagementConfig: g.engagementConfig,
      winnerCount: g.winnerCount,
      selectionMode: g.selectionMode,
      scopeType: g.scopeType,
      scopeReference: g.scopeReference,
      engagementTypes: g.engagementTypes,
      filters: g.filters,
      engagementWeights: g.engagementWeights,
    },
    planType,
  });

  if (
    options?.lockConfigHash !== undefined &&
    options.lockConfigHash !== quote.lockConfigHash
  ) {
    return {
      success: false,
      error:
        "This preview changed. Refresh the page and confirm lock again (your paid fee still applies to the same preview).",
    };
  }

  if (quote.feeSats > 0) {
    const paid = await findPaidFinalizationForLock(
      giveawayId,
      userId,
      quote.lockConfigHash
    );
    if (!paid) {
      return {
        success: false,
        error:
          "Pay the finalization fee before locking winners, or refresh if you already paid.",
      };
    }
  }

  const planLabel = getPlanDisplayName(subscription as UserSubscription | null);
  const lockedAt = new Date();

  let finalizationFeeStatus: "NONE" | "PENDING" | "PAID" | "WAIVED";
  if (quote.plannedPayoutSats <= 0) {
    finalizationFeeStatus = "NONE";
  } else if (quote.feeSats <= 0) {
    finalizationFeeStatus = "WAIVED";
  } else {
    finalizationFeeStatus = "PAID";
  }

  await updateGiveawayRow(giveawayId, {
    status: "LOCKED",
    lockedAt,
    lockedByUserId: userId,
    plannedPayoutSats: quote.plannedPayoutSats,
    finalizationFeeRateBps: quote.feeRateBps,
    finalizationFeeSats: quote.feeSats,
    finalizationFeeStatus,
    planAtFinalization: planLabel,
    lockConfigHash: quote.lockConfigHash,
    payoutState: buildInitialPayoutState(
      snapshot
    ) as unknown as Prisma.InputJsonValue,
    activityLog: appendGiveawayActivityLog(g.activityLog, "giveaway_locked", {
      lockedAt: lockedAt.toISOString(),
      plannedPayoutSats: quote.plannedPayoutSats,
      finalizationFeeSats: quote.feeSats,
      finalizationFeeStatus,
      planAtFinalization: planLabel,
    }),
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

  await updateGiveawayRow(giveawayId, {
    status: "CANCELLED",
    activityLog: appendGiveawayActivityLog(g.activityLog, "cancelled"),
  });
  return { success: true };
}

/** Clear preview snapshot and return to draft so rules can be edited. */
export async function resetGiveawayToDraft(
  userId: string,
  giveawayId: string
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "PREVIEWED") {
    return {
      success: false,
      error: "Only giveaways in preview can be reset to draft",
    };
  }

  await updateGiveawayRow(giveawayId, {
    status: "DRAFT",
    winnerSnapshot: Prisma.JsonNull,
    lastPreviewMeta: Prisma.JsonNull,
    excludedPubkeys: Prisma.JsonNull,
    rerollCount: 0,
    activityLog: appendGiveawayActivityLog(g.activityLog, "reset_to_draft"),
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

  await deleteGiveawayById(giveawayId);
  return { success: true };
}

export async function markGiveawayPaidOut(
  userId: string,
  giveawayId: string,
  options?: { completeOverrideReason?: string }
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "LOCKED")
    return {
      success: false,
      error: "Only locked giveaways can be completed",
    };

  const snapshot = g.winnerSnapshot as GiveawayWinnerEntry[] | null;
  if (!snapshot?.length)
    return { success: false, error: "No winners in giveaway" };

  const state = normalizePayoutState(g.payoutState, snapshot);
  if (!allWinnersPayoutSettled(state, snapshot)) {
    const reason = options?.completeOverrideReason?.trim() ?? "";
    if (reason.length < 10) {
      return {
        success: false,
        error:
          "Mark each winner as sent (or paid) first, or enter a reason (10+ characters) to complete with pending payouts.",
      };
    }
  }

  const completedAt = new Date().toISOString();
  await updateGiveawayRow(giveawayId, {
    status: "PAID_OUT",
    activityLog: appendGiveawayActivityLog(g.activityLog, "completed", {
      completedAt,
      ...(options?.completeOverrideReason
        ? { overrideReason: options.completeOverrideReason }
        : {}),
    }),
  });
  return { success: true };
}

export async function setGiveawayWinnerPayoutStatus(
  userId: string,
  giveawayId: string,
  winnerPubkey: string,
  status: GiveawayPayoutEntryStatus,
  note?: string | null
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  if (g.status !== "LOCKED") {
    return {
      success: false,
      error: "Payout status can only be changed while the giveaway is locked",
    };
  }
  const snapshot = g.winnerSnapshot as GiveawayWinnerEntry[] | null;
  if (!snapshot?.some((w) => w.pubkey === winnerPubkey)) {
    return { success: false, error: "Winner not in locked set" };
  }
  const state = normalizePayoutState(g.payoutState, snapshot);
  const next: (typeof state)[string] = {
    status,
    updatedAt: new Date().toISOString(),
  };
  if (note != null && note.trim() !== "") {
    next.note = note.trim();
  }
  state[winnerPubkey] = next;
  await updateGiveawayRow(giveawayId, {
    payoutState: state as unknown as Prisma.InputJsonValue,
  });
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

export async function appendGiveawayAuditActivity(
  userId: string,
  giveawayId: string,
  type: "csv_exported" | "proof_summary_copied"
): Promise<{ success: boolean; error?: string }> {
  const g = await getGiveawayById(giveawayId, userId);
  if (!g) return { success: false, error: ERROR_GIVEAWAY_NOT_FOUND };
  await updateGiveawayRow(giveawayId, {
    activityLog: appendGiveawayActivityLog(g.activityLog, type, {}),
  });
  return { success: true };
}
