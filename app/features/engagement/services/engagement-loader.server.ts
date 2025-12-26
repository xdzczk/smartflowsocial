/**
 * Engagement feed loader data preparation
 * Centralized data fetching for engagement feed page
 */

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import {
  groupNotificationsByParent,
  groupNotificationsByType,
  parseThreadViewNotifications,
  processQuoteReposts,
  type Notification,
} from "~/features/engagement/engagement.server";
import { calculateTrustScore, type User } from "~/features/engagement/trustScore";
import type {
  EngagementProfile,
  EngagementStats,
  EventStats,
  GroupedNotification,
  NostrTag,
  NotificationEvent,
  PrimalEvent,
  ThreadViewData,
} from "~/features/engagement/types";
import { getPostedPosts } from "~/models/post.queries.server";
import { getUserById } from "~/models/user.server";

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
      if (!Array.isArray(item) || item[0] !== "EVENT") continue;
      const event = item[2];
      if (!event) continue;

      if (event.kind === 0) {
        profileEvent = event;
      } else if (event.kind === 10000105) {
        statsEvent = event;
      }
    }

    // Parse profile data
    let profile: EngagementProfile = {};
    if (profileEvent && profileEvent.content) {
      try {
        profile = JSON.parse(profileEvent.content);
      } catch (e) {
        console.error("Failed to parse profile content:", e);
      }
    }

    // Parse stats data
    let stats: EngagementStats = {};
    if (statsEvent && statsEvent.content) {
      try {
        stats = JSON.parse(statsEvent.content);
      } catch (e) {
        console.error("Failed to parse stats content:", e);
      }
    }

    // Convert to User type
    const user: User = {
      pubkey,
      name: profile.name || undefined,
      displayName: profile.display_name || undefined,
      about: profile.about || undefined,
      picture: profile.picture || undefined,
      nip05: profile.nip05 || undefined,
      lud16: profile.lud16 || undefined,
      followsCount: stats.follows_count || 0,
      followersCount: stats.followers_count || 0,
      noteCount: stats.note_count || 0,
      replyCount: stats.reply_count || 0,
      timeJoined: stats.time_joined || 0,
      zapCount: stats.total_zap_count || 0,
      totalSatsZapped: stats.total_satszapped || 0,
      mediaCount: stats.media_count || 0,
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
async function fetchThreadViewWithTimeout(
  eventId: string,
  timeout = 5000,
) {
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
async function processEventBatch(
  batchIds: string[],
  userNpub: string,
) {
  const notificationPromises = batchIds.map(async (eventId) => {
    try {
      const threadViewData = await fetchThreadViewWithTimeout(eventId);
      const notifications = parseThreadViewNotifications(
        threadViewData as ThreadViewData,
        eventId,
        userNpub,
      );

      const statsEvent = (threadViewData as PrimalEvent[]).find(
        (event: PrimalEvent) =>
          Array.isArray(event) &&
          event[0] === "EVENT" &&
          event[2] &&
          event[2].kind === 10000100 &&
          event[2].content &&
          event[2].content.includes(eventId),
      );

      let eventStats = {
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      };

      if (statsEvent) {
        const content = JSON.parse(statsEvent[2].content);
        eventStats = {
          likes: content.likes || 0,
          replies: content.replies || 0,
          mentions: content.mentions || 0,
          reposts: content.reposts || 0,
          zaps: content.zaps || 0,
          satszapped: content.satszapped || 0,
        };
      }

      return {
        eventId,
        stats: eventStats,
        notifications,
      };
    } catch (error) {
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
  const [{ posts }, user] = await Promise.all([
    getPostedPosts({
      userId,
      page,
      limit,
      queueType: "all",
    }),
    getUserById(userId),
  ]);

  // Validate user data
  if (!user) {
    throw new Error("User not found");
  }

  // Ensure user has required properties with safe defaults
  user.npub = user.npub || "";
  user.filterMuted = user.filterMuted ?? false;
  user.hidePostsFromLowTrustUsers = user.hidePostsFromLowTrustUsers ?? false;
  user.mutedList = user.mutedList || { npubs: [] };

  // Get event IDs from signedEvent.id
  const eventIds = posts.map((post) => post.signedEvent.id);

  let stats: Record<string, EventStats> = {};
  let allNotifications: Notification[] = [];
  const userProfilesMap = new Map<string, User>();
  const trustScoresMap = new Map<string, number>();

  try {
    // Batch fetch notifications and stats
    const BATCH_SIZE = 10;
    const batches: string[][] = [];
    for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
      batches.push(eventIds.slice(i, i + BATCH_SIZE));
    }

    // Process batches in parallel
    const batchPromises = batches.map((batchIds) =>
      processEventBatch(batchIds, user.npub),
    );

    const allBatchResults = await Promise.all(batchPromises);
    const results = allBatchResults.flat();

    // Combine stats and notifications
    stats = results.reduce((acc, result) => {
      if (result && result.eventId && result.stats) {
        acc[result.eventId] = result.stats;
      }
      return acc;
    }, {} as Record<string, EventStats>);

    allNotifications = results.flatMap((result) =>
      result && Array.isArray(result.notifications) ? result.notifications : [],
    );

    // Filter out muted users if enabled
    if (
      user.filterMuted &&
      user.mutedList?.npubs &&
      Array.isArray(user.mutedList.npubs) &&
      user.mutedList.npubs.length > 0
    ) {
      allNotifications = filterMutedNotifications(
        allNotifications,
        user.mutedList.npubs,
      );
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
    if (user.hidePostsFromLowTrustUsers) {
      allNotifications = filterLowTrustNotifications(
        allNotifications,
        trustScoresMap,
      );
    }
  } catch (error) {
    console.error("📊 [SERVER] Error fetching stats:", error);
    // Gracefully handle errors
    stats = posts.reduce((acc, post) => {
      acc[post.signedEvent.id] = {
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      };
      return acc;
    }, {} as Record<string, EventStats>);
  }

  // Group notifications by type
  const groupedNotifications = groupNotificationsByType(allNotifications);

  // Group notifications by parent event - focus on replies only
  const groupedByParent = {
    replies: groupNotificationsByParent(
      groupedNotifications.replies,
      posts,
      [], // No longform posts in this feed
      stats,
    ),
  };

  // Filter posts to only show those with replies
  const postsWithReplies = posts.filter((post) => {
    const postStats = stats[post.signedEvent.id];
    return postStats && postStats.replies > 0;
  });

  // Fetch quote reposts using get_notifications
  let quoteRepostNotifications: NotificationEvent[] = [];
  let groupedQuoteReposts: GroupedNotification[] = [];
  try {
    const notificationsData = await connectToPrimalCache("get_notifications", {
      pubkey: user.npub,
      limit: 100,
    });

    // Extract quote reposts (kind 1 events with mention tags)
    if (Array.isArray(notificationsData)) {
      const rawQuoteReposts = notificationsData
        .filter((item: PrimalEvent) => {
          if (
            Array.isArray(item) &&
            item[0] === "EVENT" &&
            item[2]?.kind === 1
          ) {
            const event = item[2];

            if (
              !event.id ||
              !event.pubkey ||
              typeof event.content !== "string"
            ) {
              return false;
            }

            const tags = event.tags || [];

            // Skip if it's the user's own post
            if (event.pubkey === user.npub) {
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
            const isMentioningUser = mentionedUserPubkey === user.npub;

            return isMentioningUser;
          }
          return false;
        })
        .map((item: PrimalEvent) => item[2] as NotificationEvent); // Extract the event object

      // Process quote reposts
      if (rawQuoteReposts.length > 0) {
        quoteRepostNotifications = await processQuoteReposts(
          rawQuoteReposts,
          connectToPrimalCache,
        );

        // Filter out muted users if enabled
        if (
          user.filterMuted &&
          user.mutedList?.npubs &&
          Array.isArray(user.mutedList.npubs) &&
          user.mutedList.npubs.length > 0
        ) {
          quoteRepostNotifications = filterMutedNotifications(
            quoteRepostNotifications,
            user.mutedList.npubs,
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
        if (user.hidePostsFromLowTrustUsers) {
          quoteRepostNotifications = filterLowTrustNotifications(
            quoteRepostNotifications,
            trustScoresMap,
          );
        }

        // Group quote reposts by parent post
        groupedQuoteReposts = groupNotificationsByParent(
          quoteRepostNotifications,
          posts,
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
    posts: postsWithReplies || [],
    stats: stats || {},
    user: user || {},
    notifications: groupedNotifications || {
      all: [],
      replies: [],
      mentions: [],
      zaps: [],
      quotes: [],
    },
    groupedNotifications: {
      replies: groupedByParent?.replies || [],
      quotes: groupedQuoteReposts || [],
    },
    trustScores: trustScores || {},
  };
}

