import { getUserById } from "~/features/user";

import type { Giveaway } from "./data/giveaway-prisma-types.server";
import { DEFAULT_ENGAGEMENT_TYPES } from "./giveaway-actions-shared.server";
import {
  getParticipantPubkeysForFollowScope,
  processGiveawayParticipants,
  type GiveawayParticipantFilters,
} from "./giveaway-loader.server";
import { getPostsInScope } from "./giveaway-scope.server";
import {
  countEligibleAccountsForEngagementTypes,
  runGiveawayAccountPoolSelection,
  runGiveawaySelection,
  runGiveawaySelectionPerEngagement,
} from "./giveaway-selection.server";
import {
  excludeSelfEngagementForScopedRootPosts,
  filterRelatedEventsToRootNoteEngagementOnly,
} from "./giveaway-single-post-engagement.server";
import { fetchGiveawayParticipants } from "./giveaway.server";
import {
  isSimpleUnifiedEngagementConfig,
  scopeIsFollowGraphAccountPool,
  type GiveawayEngagementConfig,
  type GiveawayEngagementType,
  type GiveawayScope,
  type GiveawayWinnerEntry,
  type RelatedEvent,
} from "./types";

/** Build GiveawayScope from persisted Giveaway (scopeType + scopeReference). */
export function scopeFromGiveaway(g: Giveaway): GiveawayScope {
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
export function relatedEventsFromPubkeys(pubkeys: string[]): RelatedEvent[] {
  return pubkeys.map((pubkey, i) => ({
    id: `follow-${pubkey}-${i}`,
    pubkey,
    created_at: 0,
    kind: 7,
  }));
}

export async function getEligibleParticipantsForGiveaway(
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
  const rootEventIdToAuthorPubkey = new Map<string, string>();
  for (const p of posts) {
    const se = p.signedEvent;
    if (
      se &&
      typeof se === "object" &&
      "id" in se &&
      "pubkey" in se &&
      typeof (se as { id: unknown }).id === "string" &&
      typeof (se as { pubkey: unknown }).pubkey === "string"
    ) {
      const id = (se as { id: string }).id;
      const pk = (se as { pubkey: string }).pubkey;
      if (id.trim() && pk.trim()) {
        rootEventIdToAuthorPubkey.set(id, pk);
      }
    }
  }
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
  let eventsForSelection = relatedEvents;
  if (
    scope.type === "SINGLE_POST" &&
    eventIds.length === 1 &&
    typeof eventIds[0] === "string"
  ) {
    eventsForSelection = filterRelatedEventsToRootNoteEngagementOnly(
      relatedEvents,
      eventIds[0]
    );
  }
  eventsForSelection = excludeSelfEngagementForScopedRootPosts(
    eventsForSelection,
    rootEventIdToAuthorPubkey
  );
  const processed = await processGiveawayParticipants(
    eventsForSelection,
    userId,
    userWithDefaults,
    filters ? { filters } : undefined
  );
  return { relatedEvents: processed };
}

export function runSelectionForGiveaway(
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

  if (isSimpleUnifiedEngagementConfig(g.engagementConfig)) {
    const sats = g.engagementConfig._simpleUnified.satsPerWinner;
    const winners = runGiveawaySelection({
      relatedEvents,
      engagementTypes: types,
      selectionMode: g.selectionMode,
      engagementWeights: weights,
      winnerCount: g.winnerCount,
    });
    return winners.map((w) => ({
      ...w,
      satsPerWinner: sats > 0 ? sats : undefined,
    }));
  }

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

/** Unique eligible accounts for fairness meta (matches selection eligibility). */
export function eligibleAccountCountForPreviewMeta(
  g: Giveaway,
  relatedEvents: RelatedEvent[]
): number {
  if (scopeIsFollowGraphAccountPool(g.scopeType)) {
    return new Set(relatedEvents.map((e) => e.pubkey)).size;
  }
  const engagementConfig =
    (g.engagementConfig as GiveawayEngagementConfig | null) ?? null;
  const engagementTypes =
    g.engagementTypes as string[] as GiveawayEngagementType[];
  const types =
    engagementTypes.length > 0 ? engagementTypes : DEFAULT_ENGAGEMENT_TYPES;
  if (isSimpleUnifiedEngagementConfig(g.engagementConfig)) {
    return countEligibleAccountsForEngagementTypes(relatedEvents, types);
  }
  const typesFromConfig =
    engagementConfig && Object.keys(engagementConfig).length > 0
      ? (Object.keys(engagementConfig) as GiveawayEngagementType[])
      : [];
  const eligibilityTypes = typesFromConfig.length > 0 ? typesFromConfig : types;
  return countEligibleAccountsForEngagementTypes(
    relatedEvents,
    eligibilityTypes
  );
}
