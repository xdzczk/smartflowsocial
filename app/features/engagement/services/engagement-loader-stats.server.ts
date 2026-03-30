import { getThreadViewWithCache } from "~/features/cache/thread-view-cache.server";
import type { SignedEvent } from "~/features/nostr/types";
import { getQueueAccentHex } from "~/features/posts/queue-colors";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- `typeof` for PublishedPostsForEngagement only
import { getPublishedPosts } from "~/features/posts/server";
import type { PostData, QueueType } from "~/features/posts/types";
import { convertJsonValueToScheduleConfig } from "~/features/posts/types";
import type { UserWithHashTagPresets } from "~/features/user";
import { logError } from "~/lib/error-logger.server";

import {
  parseThreadViewNotifications,
  type Notification,
} from "../engagement.server";
import { calculateTrustScore, type User } from "../trust-score";
import type { EventStats, PrimalEvent } from "../types";

import {
  filterLowTrustNotifications,
  filterMutedNotifications,
} from "./engagement-loader-filters.server";
import { fetchUserProfile } from "./engagement-loader-profile.server";

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

export function getEventIdsFromPosts(
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

export function getMutedNpubsFromUser(user: UserWithHashTagPresets): string[] {
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

export function buildFallbackStatsFromPosts(
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

export type PublishedPostsForEngagement = Awaited<
  ReturnType<typeof getPublishedPosts>
>["posts"];

export async function fetchStatsAndNotificationsForPublishedPosts(params: {
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

export function mapPublishedPostsToPostData(
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
