/**
 * Engagement feed loader data preparation
 * Centralized data fetching for engagement feed page
 */

import { fetchFromCache } from "~/features/cache";
import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import { getThreadViewWithCache } from "~/features/cache/thread-view-cache.server";
import type { SignedEvent } from "~/features/nostr/types";
import { toPostDTOArray } from "~/features/posts/dtos";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
import type { PostData, QueueType } from "~/features/posts/types";
import { convertJsonValueToScheduleConfig } from "~/features/posts/types";
import type { UserWithHashTagPresets } from "~/features/user";
import { getUserById } from "~/features/user";
import { getUserProfileWithCache } from "~/features/user/services/user-profile-cache.server";
import {
  getEngagementLastCheckedAt,
  updateEngagementLastCheckedAt,
} from "~/features/user/services/user-settings.server";
import { logError } from "~/lib/error-logger.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";
import { getPublishedPosts } from "~/models/post.queries.server";

import { ENGAGEMENT_FEED_PAGE_SIZE } from "../constants";
import { getEngagementItemStates } from "../engagement-mark-state.server";
import {
  groupNotificationsByParent,
  groupNotificationsByType,
  parseThreadViewNotifications,
  processQuoteReposts,
  type Notification,
} from "../engagement.server";
import { calculateTrustScore, type User } from "../trust-score";
import type {
  EngagementProfile,
  EngagementStats,
  EventStats,
  GroupedNotification,
  NostrTag,
  NotificationEvent,
  PrimalEvent,
} from "../types";

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

/**
 * Fetch the logged-in user's follow list (kind 3 contacts) and return hex pubkeys.
 * Returns [] if not available or on error.
 */
async function getFollowedPubkeys(userPubkeyHex: string): Promise<string[]> {
  try {
    const responses = await fetchFromCache("event_by_addr", {
      kind: 3,
      pubkey: userPubkeyHex,
      identifier: "",
    });
    if (!Array.isArray(responses) || responses.length === 0) return [];
    for (const item of responses) {
      if (!Array.isArray(item) || item[0] !== "EVENT" || !item[2]) continue;
      const ev = item[2] as { kind?: number; tags?: string[][] };
      if (ev.kind !== 3 || !Array.isArray(ev.tags)) continue;
      return ev.tags.flatMap((t) =>
        Array.isArray(t) && t[0] === "p" && typeof t[1] === "string"
          ? [t[1]]
          : []
      );
    }
  } catch {
    // No follow list or cache error
  }
  return [];
}

function buildEmptyEngagementResponse(
  user: UserWithHashTagPresets,
  lastCheckedAt: Date | null,
  followedPubkeys: string[] = []
) {
  const stats: Record<string, EventStats> = {};
  const trustScores: Record<string, number> = {};
  const engagementItemStates: Record<
    string,
    { state: "handled"; repliedFromApp: boolean }
  > = {};
  return {
    posts: [],
    stats,
    user,
    notifications: {
      all: [],
      replies: [],
      mentions: [],
      zaps: [],
      quotes: [],
    },
    groupedNotifications: { replies: [], quotes: [], mentions: [] },
    trustScores,
    engagementItemStates,
    lastCheckedAt: lastCheckedAt?.toISOString() ?? null,
    followedPubkeys,
  };
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

/** Extract kind-1 event from Primal response item (EVENT tuple, raw event, or { event } wrapper). */
function getKind1EventFromItem(
  item: unknown
): { kind: number; tags?: NostrTag[]; [key: string]: unknown } | null {
  // Unwrap { event: ... } (some Primal responses wrap the event)
  let raw: unknown = item;
  if (
    typeof item === "object" &&
    item !== null &&
    !Array.isArray(item) &&
    "event" in item
  ) {
    raw = (item as { event: unknown }).event;
  }
  if (
    Array.isArray(raw) &&
    raw[0] === "EVENT" &&
    typeof raw[2] === "object" &&
    raw[2] !== null &&
    !Array.isArray(raw[2])
  ) {
    const ev = raw[2] as { kind?: number; tags?: NostrTag[] };
    return ev.kind === 1
      ? (ev as { kind: number; tags?: NostrTag[]; [key: string]: unknown })
      : null;
  }
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const ev = raw as { kind?: number; tags?: NostrTag[] };
    return ev.kind === 1
      ? (ev as { kind: number; tags?: NostrTag[]; [key: string]: unknown })
      : null;
  }
  return null;
}

function isPrimalItemQuoteRepostMentioningUser(
  item: PrimalEvent | Record<string, unknown>,
  userPubkeyHex: string
): boolean {
  const event = getKind1EventFromItem(
    "event" in item && typeof (item as { event: unknown }).event !== "undefined"
      ? (item as { event: unknown }).event
      : item
  );
  if (!event) return false;
  const ev = event as {
    id?: unknown;
    pubkey?: unknown;
    content?: unknown;
    kind?: number;
    tags?: NostrTag[];
  };
  if (
    !ev.id ||
    typeof ev.id !== "string" ||
    !ev.pubkey ||
    typeof ev.pubkey !== "string" ||
    typeof ev.content !== "string"
  )
    return false;
  if (ev.pubkey === userPubkeyHex) return false;
  const tags = Array.isArray(ev.tags) ? ev.tags : [];
  const eTags = tags.filter((tag: NostrTag) => tag[0] === "e");
  const pTagsWithUser = tags.filter(
    (tag: NostrTag) => tag[0] === "p" && tag[1] === userPubkeyHex
  );
  if (pTagsWithUser.length === 0) return false;
  return eTags.length > 0 || pTagsWithUser.length > 0;
}

function extractQuoteRepostEventsFromPrimal(
  notificationsData: unknown,
  userPubkeyHex: string
): NotificationEvent[] {
  let items: unknown[] = [];
  if (Array.isArray(notificationsData)) {
    if (notificationsData.length > 0) {
      const first: unknown = notificationsData[0];
      if (
        typeof first === "object" &&
        first !== null &&
        !Array.isArray(first) &&
        ("notifications" in first || "data" in first || "events" in first)
      ) {
        const obj = first as Record<string, unknown>;
        const notifications: unknown = obj["notifications"];
        const data: unknown = obj["data"];
        const events: unknown = obj["events"];
        if (Array.isArray(notifications)) items = notifications as unknown[];
        else if (Array.isArray(data)) items = data as unknown[];
        else if (Array.isArray(events)) items = events as unknown[];
      } else {
        items = notificationsData;
      }
    }
  } else if (
    notificationsData &&
    typeof notificationsData === "object" &&
    !Array.isArray(notificationsData)
  ) {
    const obj = notificationsData as Record<string, unknown>;
    if (Array.isArray(obj["notifications"])) items = obj["notifications"];
    else if (Array.isArray(obj["data"])) items = obj["data"];
    else if (Array.isArray(obj["events"])) items = obj["events"];
  }
  if (items.length === 0) return [];
  const result: NotificationEvent[] = [];
  for (const item of items) {
    if (Array.isArray(item) && item[0] === "EOSE") continue;
    if (
      !isPrimalItemQuoteRepostMentioningUser(
        item as PrimalEvent | Record<string, unknown>,
        userPubkeyHex
      )
    )
      continue;
    const event = getKind1EventFromItem(item);
    if (
      event &&
      typeof event === "object" &&
      "id" in event &&
      "pubkey" in event
    )
      result.push(event as unknown as NotificationEvent);
  }
  return result;
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
  const userPubkeyHex = nostrAdapter.decodeNpub(user.npub) ?? user.npub;
  const mutedNpubs = getMutedNpubsFromUser(user);
  const eventIds = getEventIdsFromPosts(posts);

  const followedPubkeysPromise = getFollowedPubkeys(userPubkeyHex);

  let stats: Record<string, EventStats> = {};
  let allNotifications: Notification[] = [];
  const userProfilesMap = new Map<string, User>();
  const trustScoresMap = new Map<string, number>();

  if (eventIds.length === 0) {
    const followedPubkeys = await followedPubkeysPromise;
    return buildEmptyEngagementResponse(user, lastCheckedAt, followedPubkeys);
  }

  // Fetch notifications (use fetchFromCache so empty/EOSE-only response doesn't throw)
  const notificationsPromise = fetchFromCache("get_notifications", {
    pubkey: userPubkeyHex,
    limit: 100,
  });

  try {
    // Batch fetch notifications and stats
    const BATCH_SIZE = 10;
    const batches: string[][] = [];
    for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
      batches.push(eventIds.slice(i, i + BATCH_SIZE));
    }

    // Process batches in parallel
    const batchPromises = batches.map((batchIds) =>
      processEventBatch(batchIds, userPubkeyHex)
    );

    const allBatchResults = await Promise.all(batchPromises);
    const results = allBatchResults.flat();

    // Combine stats and notifications
    const initialStats: Record<string, EventStats> = {};
    stats = results.reduce((acc, result) => {
      if (result.eventId) {
        acc[result.eventId] = result.stats;
      }
      return acc;
    }, initialStats);

    allNotifications = results.flatMap((result) =>
      Array.isArray(result.notifications) ? result.notifications : []
    );

    if (user.filterMuted && mutedNpubs.length > 0) {
      allNotifications = filterMutedNotifications(allNotifications, mutedNpubs);
    }

    // Fetch user profiles and calculate trust scores with concurrency limiting
    const uniquePubkeys = Array.from(
      new Set(
        allNotifications.map((notification) =>
          notification.type === "zap"
            ? notification.senderPubkey
            : notification.pubkey
        )
      )
    );

    // Process profiles in batches to limit concurrency
    const PROFILE_BATCH_SIZE = 10;
    const profileBatches: string[][] = [];
    for (let i = 0; i < uniquePubkeys.length; i += PROFILE_BATCH_SIZE) {
      profileBatches.push(uniquePubkeys.slice(i, i + PROFILE_BATCH_SIZE));
    }

    // Process batches sequentially, but items within batch concurrently
    for (const batch of profileBatches) {
      const batchPromises = batch.map(async (pubkey) => {
        try {
          const userProfile = await fetchUserProfile(pubkey);
          if (userProfile) {
            userProfilesMap.set(pubkey, userProfile);
            const trustScore = calculateTrustScore(userProfile);
            trustScoresMap.set(pubkey, trustScore);
          }
        } catch (error) {
          // Individual failures don't block others
          logError(error instanceof Error ? error : new Error(String(error)), {
            message: "Failed to fetch user profile",
            pubkey,
          });
        }
      });

      await Promise.allSettled(batchPromises);
    }

    if (user.hidePostsFromLowTrustUsers) {
      allNotifications = filterLowTrustNotifications(
        allNotifications,
        trustScoresMap
      );
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Error fetching engagement stats",
    });
    stats = buildFallbackStatsFromPosts(posts);
  }

  const groupedNotifications = groupNotificationsByType(allNotifications);

  const postsAsPostData: PostData[] = posts.map((post): PostData => {
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

  const groupedByParent = {
    replies: groupNotificationsByParent(
      groupedNotifications.replies,
      postsAsPostData,
      [],
      stats
    ),
    mentions: groupNotificationsByParent(
      groupedNotifications.mentions,
      postsAsPostData,
      [],
      stats
    ),
  };

  let groupedQuoteReposts: GroupedNotification[] = [];
  try {
    const notificationsData = await notificationsPromise;
    const rawQuoteReposts = extractQuoteRepostEventsFromPrimal(
      notificationsData,
      userPubkeyHex
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
      message: "Error fetching quote reposts",
    });
  }

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
  const engagementItemStates = await getEngagementItemStates(
    user.id,
    allEventIds
  );

  const postsAsDTOs = toPostDTOArray(postsAsPostData);
  const serializedGroupedReplies = serializeGroupedForResponse(
    groupedByParent.replies
  );
  const serializedGroupedQuotes =
    serializeGroupedForResponse(groupedQuoteReposts);
  const serializedGroupedMentions = serializeGroupedForResponse(
    groupedByParent.mentions
  );

  if (page === 1) {
    await updateEngagementLastCheckedAt(userId);
  }

  const followedPubkeys = await followedPubkeysPromise;

  return {
    posts: postsAsDTOs,
    stats,
    user,
    notifications: groupedNotifications,
    groupedNotifications: {
      replies: serializedGroupedReplies,
      quotes: serializedGroupedQuotes,
      mentions: serializedGroupedMentions,
    },
    trustScores,
    engagementItemStates,
    lastCheckedAt: lastCheckedAt?.toISOString() ?? null,
    followedPubkeys,
  };
}

/**
 * Load engagement data (alias for loadEngagementFeedData)
 */
export const loadEngagementData = loadEngagementFeedData;
