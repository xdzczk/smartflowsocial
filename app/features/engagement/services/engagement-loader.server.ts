/**
 * Engagement feed loader data preparation
 * Centralized data fetching for engagement feed page
 */

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import type { SignedEvent } from "~/features/nostr/types";
import type { PostData, QueueType } from "~/features/posts/types";
import { convertJsonValueToScheduleConfig } from "~/features/posts/types";
import type { UserWithHashTagPresets } from "~/features/user";
import { getUserById } from "~/features/user";
import { getPostedPosts } from "~/models/post.queries.server";

import {
  groupNotificationsByParent,
  groupNotificationsByType,
  parseThreadViewNotifications,
  processQuoteReposts,
  type Notification,
} from "../engagement.server";
import { calculateTrustScore, type User } from "../trustScore";
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
 * Fetches user profile data from Primal API and converts to User type for trust scoring
 */
async function fetchUserProfile(pubkey: string): Promise<User | null> {
  try {
    const profileData = await connectToPrimalCache("user_profile", { pubkey });

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
        console.error("Failed to parse profile content:", e);
      }
    }

    // Parse stats data
    let stats: EngagementStats = {};
    if (statsEvent?.content) {
      try {
        stats = JSON.parse(statsEvent.content) as EngagementStats;
      } catch (e) {
        console.error("Failed to parse stats content:", e);
      }
    }

    // Convert to User type
    const profileTyped = profile;
    const statsTyped = stats;
    const user: User = {
      pubkey,
      name: profileTyped.name ?? undefined,
      displayName: profileTyped.display_name ?? undefined,
      about: (profileTyped.about as string | undefined) ?? undefined,
      picture: profileTyped.picture ?? undefined,
      nip05: (profileTyped.nip05 as string | undefined) ?? undefined,
      lud16: (profileTyped.lud16 as string | undefined) ?? undefined,
      followsCount: statsTyped.follows_count ?? 0,
      followersCount: statsTyped.followers_count ?? 0,
      noteCount: statsTyped.note_count ?? 0,
      replyCount: (statsTyped.reply_count as number | undefined) ?? 0,
      timeJoined: (statsTyped.time_joined as number | undefined) ?? 0,
      zapCount: statsTyped.total_zap_count ?? 0,
      totalSatsZapped: statsTyped.total_satszapped ?? 0,
      mediaCount: (statsTyped.media_count as number | undefined) ?? 0,
    };

    return user;
  } catch (error) {
    console.error(`Failed to fetch user profile for ${pubkey}:`, error);
    return null;
  }
}

/**
 * Fetch thread view with timeout
 */
async function fetchThreadViewWithTimeout(eventId: string, timeout = 5000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timeout")), timeout),
  );

  const fetchPromise = connectToPrimalCache("thread_view", {
    event_id: eventId,
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

/**
 * Process batch of event IDs to get stats and notifications
 */
async function processEventBatch(batchIds: string[], userNpub: string) {
  const notificationPromises = batchIds.map(async (eventId) => {
    try {
      const threadViewData = await fetchThreadViewWithTimeout(eventId);
      const notifications = parseThreadViewNotifications(
        Array.isArray(threadViewData) ? threadViewData : [],
        eventId,
        userNpub,
      );

      const statsEvent = (threadViewData as PrimalEvent[]).find(
        (event: PrimalEvent) => {
          if (!Array.isArray(event) || event[0] !== "EVENT" || !event[2])
            return false;
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
        },
      );

      let eventStats = {
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      };

      if (statsEvent && Array.isArray(statsEvent) && statsEvent[2]) {
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
  mutedPubkeys: string[],
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
  trustScoresMap: Map<string, number>,
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

/**
 * Load engagement feed data
 */
export async function loadEngagementFeedData(
  userId: string,
  page = 1,
  limit = 50,
) {
  const [{ posts }, userResult] = await Promise.all([
    getPostedPosts({
      userId,
      page,
      limit,
      queueType: "all",
    }),
    getUserById(userId),
  ]);

  // Validate user data
  if (!userResult) {
    throw new Error("User not found");
  }

  const user: UserWithHashTagPresets = userResult;

  // Ensure user has required properties with safe defaults
  const userNpub = user.npub ?? "";
  const userFilterMuted = user.filterMuted ?? false;
  const userHidePostsFromLowTrustUsers =
    user.hidePostsFromLowTrustUsers ?? false;

  // Type guard for mutedList
  const mutedListData =
    user.mutedList &&
    typeof user.mutedList === "object" &&
    !Array.isArray(user.mutedList) &&
    "npubs" in user.mutedList
      ? (user.mutedList as { npubs?: unknown; lastSynced?: unknown })
      : null;
  const mutedNpubs =
    mutedListData && Array.isArray(mutedListData.npubs)
      ? (mutedListData.npubs as string[])
      : [];

  // Get event IDs from signedEvent.id
  const eventIds = posts
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
    .map((post) => {
      const se = post.signedEvent as { id: string };
      return se.id;
    });

  let stats: Record<string, EventStats> = {};
  let allNotifications: Notification[] = [];
  const userProfilesMap = new Map<string, User>();
  const trustScoresMap = new Map<string, number>();

  // Early return if no posts - skip expensive API calls
  if (eventIds.length === 0) {
    return {
      posts: [],
      stats: {},
      user: user ?? {},
      notifications: {
        all: [],
        replies: [],
        mentions: [],
        zaps: [],
        quotes: [],
      },
      groupedNotifications: {
        replies: [],
        quotes: [],
      },
      trustScores: {},
    };
  }

  try {
    // Batch fetch notifications and stats
    const BATCH_SIZE = 10;
    const batches: string[][] = [];
    for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
      batches.push(eventIds.slice(i, i + BATCH_SIZE));
    }

    // Process batches in parallel
    const batchPromises = batches.map((batchIds) =>
      processEventBatch(batchIds, userNpub),
    );

    const allBatchResults = await Promise.all(batchPromises);
    const results = allBatchResults.flat();

    // Combine stats and notifications
    const initialStats: Record<string, EventStats> = {};
    stats = results.reduce((acc, result) => {
      if (result?.eventId && result?.stats) {
        acc[result.eventId] = result.stats;
      }
      return acc;
    }, initialStats);

    allNotifications = results.flatMap((result) =>
      result && Array.isArray(result.notifications) ? result.notifications : [],
    );

    // Filter out muted users if enabled
    if (userFilterMuted && mutedNpubs.length > 0) {
      allNotifications = filterMutedNotifications(allNotifications, mutedNpubs);
    }

    // Fetch user profiles and calculate trust scores
    const uniquePubkeys = Array.from(
      new Set(
        allNotifications.map((notification) =>
          notification.type === "zap"
            ? notification.senderPubkey
            : notification.pubkey,
        ),
      ),
    );

    const profilePromises = uniquePubkeys.map(async (pubkey) => {
      const userProfile = await fetchUserProfile(pubkey);
      if (userProfile) {
        userProfilesMap.set(pubkey, userProfile);
        const trustScore = calculateTrustScore(userProfile);
        trustScoresMap.set(pubkey, trustScore);
      }
    });

    await Promise.all(profilePromises);

    // Filter out low trust users if enabled
    if (userHidePostsFromLowTrustUsers) {
      allNotifications = filterLowTrustNotifications(
        allNotifications,
        trustScoresMap,
      );
    }
  } catch (error) {
    console.error("📊 [SERVER] Error fetching stats:", error);
    // Gracefully handle errors
    stats = posts
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
      .reduce(
        (acc, post) => {
          const se = post.signedEvent;
          if (
            se &&
            typeof se === "object" &&
            !Array.isArray(se) &&
            "id" in se &&
            typeof se.id === "string"
          ) {
            const result: Record<string, EventStats> = acc;
            const eventStats: EventStats = {
              likes: 0,
              replies: 0,
              mentions: 0,
              reposts: 0,
              zaps: 0,
              satszapped: 0,
            };
            result[se.id] = eventStats;
            return result;
          }
          return acc;
        },
        ((): Record<string, EventStats> => ({}))(),
      );
  }

  // Group notifications by type
  const groupedNotifications = groupNotificationsByType(allNotifications);

  // Group notifications by parent event - focus on replies only
  // Convert PostWithQueueType[] to PostData[] for compatibility
  const postsAsPostData: PostData[] = posts.map((post) => {
    const { queueType, ...rest } = post;
    const convertedQueueType: QueueType | null = queueType
      ? {
          id: queueType.id,
          name: queueType.name,
          color: queueType.color,
          description: queueType.description,
          scheduleType: queueType.scheduleType as
            | "INTERVAL"
            | "FIXED_SLOTS"
            | undefined,
          scheduleConfig: convertJsonValueToScheduleConfig(
            queueType.scheduleConfig,
          ),
          isEnabled: queueType.isEnabled,
          userId: queueType.userId,
        }
      : null;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = {
      ...rest,
      signedEvent: post.signedEvent as SignedEvent | null | undefined,
      queueType: convertedQueueType,
    } as PostData;
    return result;
  });

  const groupedByParent = {
    replies: groupNotificationsByParent(
      groupedNotifications.replies,
      postsAsPostData,
      [], // No longform posts in this feed
      stats,
    ),
  };

  // Filter posts to only show those with replies
  const postsWithReplies = posts.filter((post) => {
    const se = post.signedEvent;
    if (
      !se ||
      typeof se !== "object" ||
      Array.isArray(se) ||
      !("id" in se) ||
      typeof (se as { id: unknown }).id !== "string"
    ) {
      return false;
    }
    const eventId = (se as { id: string }).id;
    const postStats = stats[eventId];
    return postStats && postStats.replies > 0;
  });

  // Fetch quote reposts using get_notifications
  let quoteRepostNotifications: Notification[] = [];
  let groupedQuoteReposts: GroupedNotification[] = [];
  try {
    const notificationsData = await connectToPrimalCache("get_notifications", {
      pubkey: userNpub,
      limit: 100,
    });

    // Extract quote reposts (kind 1 events with mention tags)
    if (Array.isArray(notificationsData)) {
      const rawQuoteReposts = (notificationsData as PrimalEvent[])
        .filter((item: PrimalEvent) => {
          if (
            Array.isArray(item) &&
            item[0] === "EVENT" &&
            item[2] &&
            typeof item[2] === "object" &&
            !Array.isArray(item[2]) &&
            "kind" in item[2] &&
            (item[2] as { kind?: unknown }).kind === 1
          ) {
            const event = item[2] as {
              id?: unknown;
              pubkey?: unknown;
              content?: unknown;
              kind?: unknown;
              tags?: unknown;
            };

            if (!event || typeof event !== "object" || Array.isArray(event)) {
              return false;
            }

            const eventTyped = event;
            if (
              !eventTyped.id ||
              typeof eventTyped.id !== "string" ||
              !eventTyped.pubkey ||
              typeof eventTyped.pubkey !== "string" ||
              typeof eventTyped.content !== "string"
            ) {
              return false;
            }

            const tags =
              ((eventTyped as { tags?: unknown }).tags as NostrTag[]) ?? [];

            // Skip if it's the user's own post
            if (eventTyped.pubkey === userNpub) {
              return false;
            }

            // Check if it has both "e" and "p" tags with mention marker
            const eMentionTags = tags.filter(
              (tag: NostrTag) => tag[0] === "e" && tag[3] === "mention",
            );
            const hasEMention = eMentionTags.length > 0;

            const pMentionTags = tags.filter(
              (tag: NostrTag) =>
                tag[0] === "p" && (tag[3] === "mention" || tag[3] === ""),
            );
            const hasPMention = pMentionTags.length > 0;

            if (!hasEMention || !hasPMention) {
              return false;
            }

            // Check if the mentioned user (p tag) is the current user
            const mentionedUserPubkey = tags.find(
              (tag: NostrTag) =>
                tag[0] === "p" && (tag[3] === "mention" || tag[3] === ""),
            )?.[1];
            const isMentioningUser = mentionedUserPubkey === userNpub;

            return isMentioningUser;
          }
          return false;
        })
        .map((item: PrimalEvent) => {
          if (Array.isArray(item) && item[2]) {
            return item[2] as NotificationEvent;
          }
          throw new Error("Invalid PrimalEvent structure");
        }); // Extract the event object

      // Process quote reposts
      if (rawQuoteReposts.length > 0) {
        quoteRepostNotifications = await processQuoteReposts(
          rawQuoteReposts,
          connectToPrimalCache,
        );

        // Filter out muted users if enabled
        if (userFilterMuted && mutedNpubs.length > 0) {
          quoteRepostNotifications = filterMutedNotifications(
            quoteRepostNotifications,
            mutedNpubs,
          );
        }

        // Fetch user profiles and calculate trust scores for quote reposts
        const quoteUniquePubkeys = Array.from(
          new Set(
            quoteRepostNotifications.map((notification) => notification.pubkey),
          ),
        );

        const quoteProfilePromises = quoteUniquePubkeys.map(async (pubkey) => {
          if (!userProfilesMap.has(pubkey)) {
            const userProfile = await fetchUserProfile(pubkey);
            if (userProfile) {
              userProfilesMap.set(pubkey, userProfile);
              const trustScore = calculateTrustScore(userProfile);
              trustScoresMap.set(pubkey, trustScore);
            }
          }
        });

        await Promise.all(quoteProfilePromises);

        // Filter out low trust users from quote reposts if enabled
        if (userHidePostsFromLowTrustUsers) {
          quoteRepostNotifications = filterLowTrustNotifications(
            quoteRepostNotifications,
            trustScoresMap,
          );
        }

        // Group quote reposts by parent post
        groupedQuoteReposts = groupNotificationsByParent(
          quoteRepostNotifications,
          postsAsPostData,
          [], // No longform posts in this feed
          stats,
        );
      }
    }
  } catch (error) {
    console.error(
      "🔍 [QUOTE REPOST DEBUG] Error fetching quote reposts:",
      error,
    );
  }

  // Convert trust scores map to object for JSON serialization
  const trustScores: Record<string, number> = {};
  trustScoresMap.forEach((score, pubkey) => {
    trustScores[pubkey] = score;
  });

  return {
    posts: postsWithReplies ?? [],
    stats: stats ?? {},
    user: user ?? {},
    notifications: groupedNotifications ?? {
      all: [],
      replies: [],
      mentions: [],
      zaps: [],
      quotes: [],
    },
    groupedNotifications: {
      replies: groupedByParent?.replies ?? [],
      quotes: groupedQuoteReposts ?? [],
    },
    trustScores: trustScores ?? {},
  };
}

/**
 * Load engagement data (alias for loadEngagementFeedData)
 */
export const loadEngagementData = loadEngagementFeedData;
