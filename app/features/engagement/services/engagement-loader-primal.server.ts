import type { PostData } from "~/features/posts/types";
import type { UserWithHashTagPresets } from "~/features/user";
import { logError, logWarning } from "~/lib/error-logger.server";

import {
  doesEventMentionUser,
  groupNotificationsByParent,
  inferThreadRootEventIdFromTags,
  shouldExcludeKind1FromGlobalMentionInbox,
  type Notification,
} from "../engagement.server";
import { calculateTrustScore, type User } from "../trust-score";
import type {
  EventStats,
  GroupedNotification,
  NotificationMention,
} from "../types";

import {
  filterLowTrustNotifications,
  filterMutedNotifications,
} from "./engagement-loader-filters.server";
import {
  enrichGlobalMentionNotificationsWithProfiles,
  processAndGroupQuoteReposts,
} from "./engagement-loader-notifications.server";
import { fetchUserProfile } from "./engagement-loader-profile.server";
import {
  buildGlobalMentionNotificationsFromPrimal,
  extractQuoteRepostEventsFromPrimal,
  flattenPrimalNotificationItems,
} from "./engagement-primal-notifications.server";
import { fetchKind1EventsMentioningPubkeyViaRelays } from "./relay-mentions-fallback.server";

const PUBKEY_HEX64 = /^[0-9a-f]{64}$/i;

/**
 * Kind 1 notes from Primal that mention the user but are not already in thread/quote pipelines.
 */
function publishedNostrEventIdsFromPosts(posts: PostData[]): Set<string> {
  const s = new Set<string>();
  for (const p of posts) {
    const fromSigned = p.signedEvent?.id;
    if (typeof fromSigned === "string" && fromSigned.length > 0) {
      s.add(fromSigned.toLowerCase());
    }
    const stored = (p as { nostrEventId?: string | null }).nostrEventId;
    if (typeof stored === "string" && stored.length > 0) {
      s.add(stored.toLowerCase());
    }
  }
  return s;
}

export async function loadPrimalSupplementalEngagementData(params: {
  notificationsResultPromise: Promise<{
    data: unknown;
    getNotificationsFailed: boolean;
    primalNotificationsSkipped: boolean;
  }>;
  allNotifications: Notification[];
  user: UserWithHashTagPresets;
  userPubkeyHex: string;
  mutedNpubs: string[];
  userProfilesMap: Map<string, User>;
  trustScoresMap: Map<string, number>;
  postsAsPostData: PostData[];
  stats: Record<string, EventStats>;
}): Promise<{
  groupedGlobalMentions: GroupedNotification[];
  groupedQuoteReposts: GroupedNotification[];
  globalMentionNotifications: NotificationMention[];
}> {
  const {
    notificationsResultPromise,
    allNotifications,
    user,
    userPubkeyHex,
    mutedNpubs,
    userProfilesMap,
    trustScoresMap,
    postsAsPostData,
    stats,
  } = params;

  let groupedGlobalMentions: GroupedNotification[] = [];
  let groupedQuoteReposts: GroupedNotification[] = [];
  let globalMentionNotifications: NotificationMention[] = [];

  const {
    data: notificationsData,
    getNotificationsFailed,
    primalNotificationsSkipped,
  } = await notificationsResultPromise;

  try {
    const rawQuoteReposts = extractQuoteRepostEventsFromPrimal(
      notificationsData,
      userPubkeyHex
    );

    const excludeIds = new Set<string>();
    for (const n of allNotifications) {
      excludeIds.add(n.eventId);
    }
    for (const ev of rawQuoteReposts) {
      excludeIds.add(ev.id);
    }

    const userPublishedEventIds =
      publishedNostrEventIdsFromPosts(postsAsPostData);

    globalMentionNotifications = buildGlobalMentionNotificationsFromPrimal(
      notificationsData,
      userPubkeyHex,
      excludeIds,
      userPublishedEventIds
    );

    const relayFallbackEnabled =
      process.env["MENTIONS_RELAY_FALLBACK_ENABLED"] !== "false";
    let relayFallbackRan = false;
    const canQueryRelayForPubkey = PUBKEY_HEX64.test(userPubkeyHex);
    if (
      relayFallbackEnabled &&
      globalMentionNotifications.length === 0 &&
      canQueryRelayForPubkey
    ) {
      relayFallbackRan = true;
      const relayEvents = await fetchKind1EventsMentioningPubkeyViaRelays(
        userPubkeyHex,
        { userRelays: user.userRelays }
      );
      const userLower = userPubkeyHex.toLowerCase();
      const fromRelay: NotificationMention[] = [];
      for (const e of relayEvents) {
        if (e.pubkey.toLowerCase() === userLower) continue;
        if (excludeIds.has(e.id)) continue;
        if (!doesEventMentionUser(e.content, e.tags, userPubkeyHex)) continue;
        if (
          shouldExcludeKind1FromGlobalMentionInbox(
            e.tags,
            userPublishedEventIds
          )
        ) {
          continue;
        }
        fromRelay.push({
          type: "mention",
          id: e.id,
          eventId: e.id,
          content: e.content,
          createdAt: e.created_at,
          pubkey: e.pubkey,
          originalEventId: inferThreadRootEventIdFromTags(e.tags, e.id),
        });
      }
      fromRelay.sort((a, b) => b.createdAt - a.createdAt);
      globalMentionNotifications = fromRelay;
    }

    if (process.env["ENGAGEMENT_MENTIONS_DEBUG"] === "true") {
      logWarning("Engagement mentions debug", {
        primalNotificationsSkipped,
        getNotificationsFailed,
        primalRowCount:
          flattenPrimalNotificationItems(notificationsData).length,
        globalMentionCount: globalMentionNotifications.length,
        relayFallbackRan,
      });
    }

    if (user.filterMuted && mutedNpubs.length > 0) {
      globalMentionNotifications = filterMutedNotifications(
        globalMentionNotifications,
        mutedNpubs
      ) as NotificationMention[];
    }

    const globalPubkeys = [
      ...new Set(globalMentionNotifications.map((n) => n.pubkey)),
    ];
    const GLOBAL_PROFILE_BATCH = 10;
    for (let i = 0; i < globalPubkeys.length; i += GLOBAL_PROFILE_BATCH) {
      const batch = globalPubkeys.slice(i, i + GLOBAL_PROFILE_BATCH);
      await Promise.allSettled(
        batch.map(async (pubkey) => {
          if (userProfilesMap.has(pubkey)) return;
          try {
            const userProfile = await fetchUserProfile(pubkey);
            if (userProfile) {
              userProfilesMap.set(pubkey, userProfile);
              trustScoresMap.set(pubkey, calculateTrustScore(userProfile));
            }
          } catch (error) {
            logError(
              error instanceof Error ? error : new Error(String(error)),
              {
                message: "Failed to fetch profile for global mention",
                pubkey,
              }
            );
          }
        })
      );
    }

    if (user.hidePostsFromLowTrustUsers) {
      globalMentionNotifications = filterLowTrustNotifications(
        globalMentionNotifications,
        trustScoresMap
      ) as NotificationMention[];
    }

    globalMentionNotifications = enrichGlobalMentionNotificationsWithProfiles(
      globalMentionNotifications,
      userProfilesMap
    );

    groupedGlobalMentions = groupNotificationsByParent(
      globalMentionNotifications,
      postsAsPostData,
      [],
      stats,
      { syntheticFallbackPubkey: userPubkeyHex }
    );

    groupedQuoteReposts = await processAndGroupQuoteReposts(
      rawQuoteReposts,
      userPubkeyHex,
      user.filterMuted,
      user.hidePostsFromLowTrustUsers,
      mutedNpubs,
      userProfilesMap,
      trustScoresMap,
      postsAsPostData,
      stats
    );
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching Primal notifications (quotes / global mentions)",
    });
  }

  return {
    groupedGlobalMentions,
    groupedQuoteReposts,
    globalMentionNotifications,
  };
}

export function collectEventIdsFromGroupedNotificationGroups(
  replyGroups: GroupedNotification[],
  quoteGroups: GroupedNotification[],
  mentionGroups: GroupedNotification[]
): string[] {
  const ids: string[] = [];
  for (const group of replyGroups) {
    for (const n of group.notifications) {
      if (n.eventId) ids.push(n.eventId);
    }
  }
  for (const group of quoteGroups) {
    for (const n of group.notifications) {
      if (n.eventId) ids.push(n.eventId);
    }
  }
  for (const group of mentionGroups) {
    for (const n of group.notifications) {
      if (n.eventId) ids.push(n.eventId);
    }
  }
  return ids;
}
