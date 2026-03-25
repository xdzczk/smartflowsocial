/**
 * Engagement feed loader data preparation
 * Centralized data fetching for engagement feed page
 */

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import { getThreadViewWithCache } from "~/features/cache/thread-view-cache.server";
import { getFollowedPubkeys } from "~/features/nostr/social-graph.server";
import type { SignedEvent } from "~/features/nostr/types";
import { toPostDTOArray } from "~/features/posts/dtos";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import { getPublishedPosts } from "~/features/posts/server";
import type { PostData, QueueType } from "~/features/posts/types";
import { convertJsonValueToScheduleConfig } from "~/features/posts/types";
import type { UserWithHashTagPresets } from "~/features/user";
import { getUserById } from "~/features/user";
import { getUserProfileWithCache } from "~/features/user/services/user-profile-cache.server";
import {
  getEngagementLastCheckedAt,
  updateEngagementLastCheckedAt,
} from "~/features/user/services/user-settings.server";
import { logError, logWarning } from "~/lib/error-logger.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

import { ENGAGEMENT_FEED_PAGE_SIZE } from "../constants";
import { getEngagementItemStates } from "../engagement-mark-state.server";
import {
  doesEventMentionUser,
  groupNotificationsByParent,
  groupNotificationsByType,
  inferThreadRootEventIdFromTags,
  parseThreadViewNotifications,
  processQuoteReposts,
  shouldExcludeKind1FromGlobalMentionInbox,
  type Notification,
} from "../engagement.server";
import { findLinkedActionsByEventIds } from "../repositories/engagement-item-state.server";
import { calculateTrustScore, type User } from "../trust-score";
import type {
  EngagementLinkedAction,
  EngagementProfile,
  EngagementGroupSummary,
  EngagementStats,
  EventStats,
  GroupedNotification,
  NotificationMention,
  NostrTag,
  NotificationEvent,
  PrimalEvent,
} from "../types";

import {
  buildGlobalMentionNotificationsFromPrimal,
  extractQuoteRepostEventsFromPrimal,
  flattenPrimalNotificationItems,
  loadPrimalGetNotificationsResult,
} from "./engagement-primal-notifications.server";
import { fetchKind1EventsMentioningPubkeyViaRelays } from "./relay-mentions-fallback.server";

/** Primal `get_notifications` payload size (global mentions + quotes). */
const PRIMAL_NOTIFICATIONS_LIMIT = 200;

const PUBKEY_HEX64 = /^[0-9a-f]{64}$/i;

/**
 * Fetches user profile data using cached version and converts to User type for trust scoring
 */
async function fetchUserProfile(pubkey: string): Promise<User | null> {
  try {
    const profileData = await getUserProfileWithCache(pubkey);

    if (!Array.isArray(profileData)) {
      return null;
    }

    // Find kind 0 (profile) and kind 10000105 (stats) events
    let profileEvent = null;
    let statsEvent = null;

    for (const item of profileData) {
      if (!Array.isArray(item) || item[0] !== "EVENT" || !item[2]) continue;
      const rawEventData: unknown = item[2] as unknown;
      if (
        !rawEventData ||
        typeof rawEventData !== "object" ||
        Array.isArray(rawEventData)
      )
        continue;
      const event: { kind?: number; content?: string } = rawEventData as {
        kind?: number;
        content?: string;
      };

      if (event.kind === 0) {
        profileEvent = event;
      } else if (event.kind === 10000105) {
        statsEvent = event;
      }
    }

    // Parse profile data
    let profile: EngagementProfile = {};
    if (profileEvent?.content) {
      try {
        profile = JSON.parse(profileEvent.content) as EngagementProfile;
      } catch (e) {
        logError(e instanceof Error ? e : new Error(String(e)), {
          message: "Failed to parse profile content",
          pubkey,
        });
      }
    }

    // Parse stats data
    let stats: EngagementStats = {};
    if (statsEvent?.content) {
      try {
        stats = JSON.parse(statsEvent.content) as EngagementStats;
      } catch (e) {
        logError(e instanceof Error ? e : new Error(String(e)), {
          message: "Failed to parse stats content",
          pubkey,
        });
      }
    }

    // Convert to User type
    const profileTyped = profile;
    const statsTyped = stats;
    const user: User = {
      pubkey,
      name: profileTyped.name,
      displayName: profileTyped.display_name,
      about: (profileTyped["about"] as string | undefined) ?? undefined,
      picture: profileTyped.picture,
      nip05: (profileTyped["nip05"] as string | undefined) ?? undefined,
      lud16: (profileTyped["lud16"] as string | undefined) ?? undefined,
      followsCount: statsTyped.follows_count ?? 0,
      followersCount: statsTyped.followers_count ?? 0,
      noteCount: statsTyped.note_count ?? 0,
      replyCount: (statsTyped["reply_count"] as number | undefined) ?? 0,
      timeJoined: (statsTyped["time_joined"] as number | undefined) ?? 0,
      zapCount: statsTyped.total_zap_count ?? 0,
      totalSatsZapped: statsTyped.total_satszapped ?? 0,
      mediaCount: (statsTyped["media_count"] as number | undefined) ?? 0,
    };

    return user;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Failed to fetch user profile",
      pubkey,
    });
    return null;
  }
}

/**
 * Process batch of event IDs to get stats and notifications.
 * userPubkeyHex: logged-in user's pubkey in hex (for Primal/event comparisons).
 */
async function processEventBatch(batchIds: string[], userPubkeyHex: string) {
  const notificationPromises = batchIds.map(async (eventId) => {
    try {
      const threadViewData = await getThreadViewWithCache(eventId);
      const notifications = parseThreadViewNotifications(
        Array.isArray(threadViewData) ? threadViewData : [],
        eventId,
        userPubkeyHex
      );

      const statsEvent = (threadViewData as PrimalEvent[]).find(
        (event: PrimalEvent) => {
          if (!Array.isArray(event) || event[0] !== "EVENT") return false;
          const eventData = event[2];
          if (typeof eventData !== "object" || Array.isArray(eventData))
            return false;
          const eventTyped = eventData as { kind?: number; content?: string };
          return (
            eventTyped.kind === 10000100 &&
            eventTyped.content &&
            typeof eventTyped.content === "string" &&
            eventTyped.content.includes(eventId)
          );
        }
      );

      let eventStats = {
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      };

      if (statsEvent && Array.isArray(statsEvent)) {
        const eventData = statsEvent[2] as { kind?: number; content?: string };
        if (eventData.content) {
          try {
            const content = JSON.parse(eventData.content) as {
              likes?: number;
              replies?: number;
              mentions?: number;
              reposts?: number;
              zaps?: number;
              satszapped?: number;
            };
            eventStats = {
              likes: content.likes ?? 0,
              replies: content.replies ?? 0,
              mentions: content.mentions ?? 0,
              reposts: content.reposts ?? 0,
              zaps: content.zaps ?? 0,
              satszapped: content.satszapped ?? 0,
            };
          } catch {
            // Ignore parse errors
          }
        }
      }

      return {
        eventId,
        stats: eventStats,
        notifications,
      };
    } catch (_error) {
      return {
        eventId,
        stats: {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
        notifications: [],
      };
    }
  });

  return Promise.all(notificationPromises);
}

/**
 * Filter notifications by muted users
 */
function filterMutedNotifications(
  notifications: Notification[],
  mutedPubkeys: string[]
): Notification[] {
  return notifications.filter((notification) => {
    const pubkeyToCheck =
      notification.type === "zap"
        ? notification.senderPubkey
        : notification.pubkey;
    return !mutedPubkeys.includes(pubkeyToCheck);
  });
}

/**
 * Filter notifications by trust score
 */
function filterLowTrustNotifications(
  notifications: Notification[],
  trustScoresMap: Map<string, number>
): Notification[] {
  return notifications.filter((notification) => {
    const pubkeyToCheck =
      notification.type === "zap"
        ? notification.senderPubkey
        : notification.pubkey;
    const trustScore = trustScoresMap.get(pubkeyToCheck);
    return trustScore === undefined || trustScore >= 40;
  });
}

function getEventIdsFromPosts(
  posts: Array<{ signedEvent: unknown }>
): string[] {
  return posts
    .filter((post) => {
      const se = post.signedEvent;
      return (
        se &&
        typeof se === "object" &&
        !Array.isArray(se) &&
        "id" in se &&
        typeof (se as { id: unknown }).id === "string"
      );
    })
    .map((post) => (post.signedEvent as { id: string }).id);
}

function getMutedNpubsFromUser(user: UserWithHashTagPresets): string[] {
  const mutedListData =
    user.mutedList &&
    typeof user.mutedList === "object" &&
    !Array.isArray(user.mutedList) &&
    "npubs" in user.mutedList
      ? (user.mutedList as { npubs?: unknown })
      : null;
  return mutedListData && Array.isArray(mutedListData.npubs)
    ? (mutedListData.npubs as string[])
    : [];
}

function buildFallbackStatsFromPosts(
  posts: Array<{ signedEvent: unknown }>
): Record<string, EventStats> {
  const emptyStats: EventStats = {
    likes: 0,
    replies: 0,
    mentions: 0,
    reposts: 0,
    zaps: 0,
    satszapped: 0,
  };
  return posts
    .filter((post) => {
      const se = post.signedEvent;
      return (
        se &&
        typeof se === "object" &&
        !Array.isArray(se) &&
        "id" in se &&
        typeof (se as { id: string }).id === "string"
      );
    })
    .reduce<Record<string, EventStats>>((acc, post) => {
      const se = post.signedEvent as { id: string };
      acc[se.id] = { ...emptyStats };
      return acc;
    }, {});
}

/**
 * Merge grouped notifications by parent `eventId`, deduping child notifications by `eventId`.
 */
function mergeGroupedNotificationsByParent(
  a: GroupedNotification[],
  b: GroupedNotification[]
): GroupedNotification[] {
  const map = new Map<string, GroupedNotification>();

  function absorb(group: GroupedNotification) {
    const key = group.parentPost.eventId;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        parentPost: { ...group.parentPost },
        notifications: [...group.notifications],
      });
      return;
    }
    const seen = new Set(existing.notifications.map((n) => n.eventId));
    for (const n of group.notifications) {
      if (!seen.has(n.eventId)) {
        existing.notifications.push(n);
        seen.add(n.eventId);
      }
    }
    existing.notifications.sort((x, y) => y.createdAt - x.createdAt);
  }

  for (const g of a) absorb(g);
  for (const g of b) absorb(g);

  return [...map.values()].sort((g1, g2) => {
    const latest = (g: GroupedNotification) =>
      Math.max(0, ...g.notifications.map((n) => n.createdAt));
    return latest(g2) - latest(g1);
  });
}

/**
 * Kind 1 notes from Primal that mention the user but are not already in thread/quote pipelines.
 */
function publishedNostrEventIdsFromPosts(posts: PostData[]): Set<string> {
  const s = new Set<string>();
  for (const p of posts) {
    const fromSigned = p.signedEvent?.id;
    if (typeof fromSigned === "string" && fromSigned.length > 0) {
      s.add(fromSigned);
    }
    const stored = (p as { nostrEventId?: string | null }).nostrEventId;
    if (typeof stored === "string" && stored.length > 0) {
      s.add(stored);
    }
  }
  return s;
}

async function processAndGroupQuoteReposts(
  rawQuoteReposts: NotificationEvent[],
  userPubkeyHex: string,
  userFilterMuted: boolean,
  userHidePostsFromLowTrustUsers: boolean,
  mutedNpubs: string[],
  userProfilesMap: Map<string, User>,
  trustScoresMap: Map<string, number>,
  postsAsPostData: PostData[],
  stats: Record<string, EventStats>
): Promise<GroupedNotification[]> {
  if (rawQuoteReposts.length === 0) return [];
  let quoteRepostNotifications: Notification[] = await processQuoteReposts(
    rawQuoteReposts,
    connectToPrimalCache
  );
  if (userFilterMuted && mutedNpubs.length > 0) {
    quoteRepostNotifications = filterMutedNotifications(
      quoteRepostNotifications,
      mutedNpubs
    );
  }
  const quoteUniquePubkeys = Array.from(
    new Set(quoteRepostNotifications.map((n) => n.pubkey))
  );
  const quoteProfilePromises = quoteUniquePubkeys.map(async (pubkey) => {
    if (!userProfilesMap.has(pubkey)) {
      const userProfile = await fetchUserProfile(pubkey);
      if (userProfile) {
        userProfilesMap.set(pubkey, userProfile);
        trustScoresMap.set(pubkey, calculateTrustScore(userProfile));
      }
    }
  });
  await Promise.all(quoteProfilePromises);
  if (userHidePostsFromLowTrustUsers) {
    quoteRepostNotifications = filterLowTrustNotifications(
      quoteRepostNotifications,
      trustScoresMap
    );
  }
  return groupNotificationsByParent(
    quoteRepostNotifications,
    postsAsPostData,
    [],
    stats
  );
}

/** Author pubkey of a notification (for self-filter). */
function getNotificationAuthorPubkey(n: Notification): string {
  return n.type === "zap"
    ? (n as { senderPubkey: string }).senderPubkey
    : n.pubkey;
}

/** Remove notifications from groups where the author is the current user (case-insensitive). */
function filterGroupedExcludingUser(
  groups: GroupedNotification[],
  userPubkeyHex: string
): GroupedNotification[] {
  const userLower = userPubkeyHex.toLowerCase();
  return groups
    .map((group) => ({
      ...group,
      notifications: group.notifications.filter(
        (n) => getNotificationAuthorPubkey(n).toLowerCase() !== userLower
      ),
    }))
    .filter((group) => group.notifications.length > 0);
}

/** Serialize grouped notifications for JSON response (publishedAt → ISO string). */
function serializeGroupedForResponse(
  groups: GroupedNotification[]
): GroupedNotification[] {
  return groups.map((group) => ({
    ...group,
    parentPost: {
      ...group.parentPost,
      publishedAt: group.parentPost.publishedAt
        ? group.parentPost.publishedAt.toISOString()
        : null,
    },
  })) as GroupedNotification[];
}

type PublishedPostsForEngagement = Awaited<
  ReturnType<typeof getPublishedPosts>
>["posts"];

async function fetchStatsAndNotificationsForPublishedPosts(params: {
  eventIds: string[];
  userPubkeyHex: string;
  user: UserWithHashTagPresets;
  mutedNpubs: string[];
  posts: PublishedPostsForEngagement;
  userProfilesMap: Map<string, User>;
  trustScoresMap: Map<string, number>;
}): Promise<{
  stats: Record<string, EventStats>;
  allNotifications: Notification[];
}> {
  const {
    eventIds,
    userPubkeyHex,
    user,
    mutedNpubs,
    posts,
    userProfilesMap,
    trustScoresMap,
  } = params;

  if (eventIds.length === 0) {
    return {
      stats: buildFallbackStatsFromPosts(posts),
      allNotifications: [],
    };
  }

  const BATCH_SIZE = 10;
  const batches: string[][] = [];
  for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
    batches.push(eventIds.slice(i, i + BATCH_SIZE));
  }

  const batchPromises = batches.map((batchIds) =>
    processEventBatch(batchIds, userPubkeyHex)
  );

  const allBatchResults = await Promise.all(batchPromises);
  const results = allBatchResults.flat();

  const initialStats: Record<string, EventStats> = {};
  const stats = results.reduce((acc, result) => {
    if (result.eventId) {
      acc[result.eventId] = result.stats;
    }
    return acc;
  }, initialStats);

  let allNotifications = results.flatMap((result) =>
    Array.isArray(result.notifications) ? result.notifications : []
  );

  if (user.filterMuted && mutedNpubs.length > 0) {
    allNotifications = filterMutedNotifications(allNotifications, mutedNpubs);
  }

  const uniquePubkeys = Array.from(
    new Set(
      allNotifications.map((notification) =>
        notification.type === "zap"
          ? notification.senderPubkey
          : notification.pubkey
      )
    )
  );

  const PROFILE_BATCH_SIZE = 10;
  const profileBatches: string[][] = [];
  for (let i = 0; i < uniquePubkeys.length; i += PROFILE_BATCH_SIZE) {
    profileBatches.push(uniquePubkeys.slice(i, i + PROFILE_BATCH_SIZE));
  }

  for (const batch of profileBatches) {
    const profilePromises = batch.map(async (pubkey) => {
      try {
        const userProfile = await fetchUserProfile(pubkey);
        if (userProfile) {
          userProfilesMap.set(pubkey, userProfile);
          const trustScore = calculateTrustScore(userProfile);
          trustScoresMap.set(pubkey, trustScore);
        }
      } catch (error) {
        logError(error instanceof Error ? error : new Error(String(error)), {
          message: "Failed to fetch user profile",
          pubkey,
        });
      }
    });

    await Promise.allSettled(profilePromises);
  }

  if (user.hidePostsFromLowTrustUsers) {
    allNotifications = filterLowTrustNotifications(
      allNotifications,
      trustScoresMap
    );
  }

  return { stats, allNotifications };
}

function mapPublishedPostsToPostData(
  posts: PublishedPostsForEngagement
): PostData[] {
  return posts.map((post): PostData => {
    const { queueType, ...rest } = post;
    const convertedQueueType: QueueType | null = queueType
      ? {
          id: queueType.id,
          name: queueType.name,
          color: getQueueAccentHex(queueType.colorToken ?? null),
          colorToken: queueType.colorToken ?? undefined,
          description: queueType.description,
          scheduleType: queueType.scheduleType as
            | "INTERVAL"
            | "FIXED_SLOTS"
            | "WEEKLY_SLOTS"
            | undefined,
          scheduleConfig: convertJsonValueToScheduleConfig(
            queueType.scheduleConfig
          ),
          isEnabled: queueType.isEnabled,
          userId: queueType.userId,
        }
      : null;
    const signedEvent = post.signedEvent as SignedEvent | null | undefined;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Prisma query result spread compatible with PostData at runtime
    return {
      ...rest,
      signedEvent,
      queueType: convertedQueueType,
    } as PostData;
  });
}

function computeGroupSummaries(params: {
  groups: GroupedNotification[];
  states: Record<
    string,
    {
      state:
        | "UNHANDLED"
        | "DRAFTED"
        | "SCHEDULED"
        | "REPLIED"
        | "IGNORED"
        | "SNOOZED"
        | "HANDLED";
      repliedFromApp: boolean;
      snoozedUntil?: string | null;
    }
  >;
  linked: Record<string, EngagementLinkedAction[]>;
}): Record<string, EngagementGroupSummary> {
  const { groups, states, linked } = params;
  const summaries: Record<string, EngagementGroupSummary> = {};
  for (const group of groups) {
    let drafted = 0;
    let scheduled = 0;
    let handled = 0;
    let needResponse = 0;
    const total = group.notifications.length;
    for (const notification of group.notifications) {
      const eventId = notification.eventId;
      const state = states[eventId];
      const links = linked[eventId] ?? [];
      const hasScheduled = links.some((action) =>
        action.kind.startsWith("SCHEDULED_")
      );
      const hasDraft = links.some((action) => action.kind === "DRAFT");
      if (hasDraft || state?.state === "DRAFTED") drafted += 1;
      if (hasScheduled || state?.state === "SCHEDULED") scheduled += 1;
      if (
        state?.state === "REPLIED" ||
        state?.state === "HANDLED" ||
        state?.state === "IGNORED"
      ) {
        handled += 1;
      }
      const isSuppressed =
        state?.state === "IGNORED" ||
        state?.state === "SNOOZED" ||
        hasScheduled ||
        state?.state === "REPLIED" ||
        state?.state === "HANDLED";
      if (!isSuppressed) needResponse += 1;
    }
    summaries[group.parentPost.eventId] = {
      total,
      needResponse,
      drafted,
      scheduled,
      handled,
    };
  }
  return summaries;
}

async function loadPrimalSupplementalEngagementData(params: {
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
            e.tags as NostrTag[],
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
          originalEventId: inferThreadRootEventIdFromTags(
            e.tags as NostrTag[],
            e.id
          ),
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

/**
 * Load engagement feed data
 */
export async function loadEngagementFeedData(
  userId: string,
  page = 1,
  limit = ENGAGEMENT_FEED_PAGE_SIZE
) {
  const [{ posts }, userResult, lastCheckedAt] = await Promise.all([
    getPublishedPosts({
      userId,
      page,
      limit,
      queueType: "all",
    }),
    getUserById(userId),
    getEngagementLastCheckedAt(userId),
  ]);

  if (!userResult) throw new Error("User not found");
  const user: UserWithHashTagPresets = userResult;
  const npub = user.npub;
  const userPubkeyHex = nostrAdapter.decodeNpub(npub) ?? npub;
  const mutedNpubs = getMutedNpubsFromUser(user);
  const eventIds = getEventIdsFromPosts(posts);

  const followedPubkeysPromise = getFollowedPubkeys(userPubkeyHex);

  // Global mentions + quotes from Primal (not scoped to SmartFlow-published roots).
  // `get_notifications` is on Primal public caches; open-source app.jl may omit it — use
  // MENTIONS_USE_PRIMAL_GET_NOTIFICATIONS=false or rely on relay fallback when empty/failed.
  const notificationsResultPromise = loadPrimalGetNotificationsResult({
    pubkey: userPubkeyHex,
    limit: PRIMAL_NOTIFICATIONS_LIMIT,
  });

  let stats: Record<string, EventStats> = {};
  let allNotifications: Notification[] = [];
  const userProfilesMap = new Map<string, User>();
  const trustScoresMap = new Map<string, number>();

  try {
    const fetched = await fetchStatsAndNotificationsForPublishedPosts({
      eventIds,
      userPubkeyHex,
      user,
      mutedNpubs,
      posts,
      userProfilesMap,
      trustScoresMap,
    });
    stats = fetched.stats;
    allNotifications = fetched.allNotifications;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching engagement stats",
    });
    stats = buildFallbackStatsFromPosts(posts);
  }

  const groupedNotifications = groupNotificationsByType(allNotifications);

  const postsAsPostData = mapPublishedPostsToPostData(posts);

  const groupedByParentReplies = groupNotificationsByParent(
    groupedNotifications.replies,
    postsAsPostData,
    [],
    stats
  );

  const groupedThreadMentions = groupNotificationsByParent(
    groupedNotifications.mentions,
    postsAsPostData,
    [],
    stats
  );

  const {
    groupedGlobalMentions,
    groupedQuoteReposts,
    globalMentionNotifications,
  } = await loadPrimalSupplementalEngagementData({
    notificationsResultPromise,
    allNotifications,
    user,
    userPubkeyHex,
    mutedNpubs,
    userProfilesMap,
    trustScoresMap,
    postsAsPostData,
    stats,
  });

  const mergedMentionGroups = mergeGroupedNotificationsByParent(
    groupedThreadMentions,
    groupedGlobalMentions
  );

  const groupedByParent = {
    replies: groupedByParentReplies,
    mentions: mergedMentionGroups,
  };

  const notificationsForResponse = {
    ...groupedNotifications,
    mentions: [...groupedNotifications.mentions, ...globalMentionNotifications],
    all: [...groupedNotifications.all, ...globalMentionNotifications],
  };

  const trustScores: Record<string, number> = {};
  trustScoresMap.forEach((score, pubkey) => {
    trustScores[pubkey] = score;
  });

  const allEventIds: string[] = [];
  for (const group of groupedByParent.replies) {
    for (const n of group.notifications) {
      if (n.eventId) allEventIds.push(n.eventId);
    }
  }
  for (const group of groupedQuoteReposts) {
    for (const n of group.notifications) {
      if (n.eventId) allEventIds.push(n.eventId);
    }
  }
  for (const group of groupedByParent.mentions) {
    for (const n of group.notifications) {
      if (n.eventId) allEventIds.push(n.eventId);
    }
  }
  const engagementItemStates = await getEngagementItemStates(
    user.id,
    allEventIds
  );
  const linkedActionsRows = await findLinkedActionsByEventIds(
    user.id,
    allEventIds
  );
  const engagementLinkedActions = linkedActionsRows.reduce<
    Record<string, EngagementLinkedAction[]>
  >((acc, row) => {
    const key = row.eventId;
    acc[key] ??= [];
    acc[key].push({
      kind: row.kind,
      postId: row.postId,
      draftId: row.draftId,
      queueTypeId: row.queueTypeId,
      label: row.label,
      scheduledFor: row.scheduledFor?.toISOString() ?? null,
      isCanceled: row.isCanceled,
      isPublished: row.isPublished,
    });
    return acc;
  }, {});

  const postsAsDTOs = toPostDTOArray(postsAsPostData);
  const serializedGroupedReplies = serializeGroupedForResponse(
    groupedByParent.replies
  );
  const quotesExcludingSelf = filterGroupedExcludingUser(
    groupedQuoteReposts,
    userPubkeyHex
  );
  const mentionsExcludingSelf = filterGroupedExcludingUser(
    groupedByParent.mentions,
    userPubkeyHex
  );
  const serializedGroupedQuotes =
    serializeGroupedForResponse(quotesExcludingSelf);
  const serializedGroupedMentions = serializeGroupedForResponse(
    mentionsExcludingSelf
  );
  const allVisibleGroups = [
    ...serializedGroupedReplies,
    ...serializedGroupedQuotes,
    ...serializedGroupedMentions,
  ];
  const groupSummaries = computeGroupSummaries({
    groups: allVisibleGroups,
    states: engagementItemStates,
    linked: engagementLinkedActions,
  });

  if (page === 1) {
    await updateEngagementLastCheckedAt(userId);
  }

  let followedPubkeys: string[] = [];
  try {
    followedPubkeys = await followedPubkeysPromise;
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message:
        "Failed to load follow list for engagement feed; continuing empty",
      userId,
    });
    followedPubkeys = [];
  }

  return {
    posts: postsAsDTOs,
    stats,
    user,
    notifications: notificationsForResponse,
    groupedNotifications: {
      replies: serializedGroupedReplies,
      quotes: serializedGroupedQuotes,
      mentions: serializedGroupedMentions,
    },
    trustScores,
    engagementItemStates,
    engagementLinkedActions,
    groupSummaries,
    lastCheckedAt: lastCheckedAt?.toISOString() ?? null,
    followedPubkeys,
  };
}

/**
 * Load engagement data (alias for loadEngagementFeedData)
 */
export const loadEngagementData = loadEngagementFeedData;
