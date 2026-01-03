/**
 * Giveaway loader data preparation
 * Centralized data fetching and processing for giveaway page
 */

import { calculateTrustScore } from "~/features/engagement/trustScore";
import type { User } from "~/features/engagement/trustScore";
import {
  toPostDTOArray,
  type PostDTO,
} from "~/features/posts/dtos";
import type { PostData } from "~/features/posts/types";
import { convertPrismaQueueTypeToQueueType } from "~/features/posts/types";
import { convertToHex } from "~/lib/helpers";
import { connectToPrimalCache } from "~/lib/nostrwebsocket.server";
import { getRecentPostedPosts } from "~/models/post.queries.server";
import {
  getGiveawayBlacklist,
  getUserById,
  getQueueTypes,
} from "~/models/user.server";

import { fetchGiveawayParticipants } from "./giveaway.server";
import type {
  GiveawayProfile,
  GiveawayStats,
  PrimalEvent,
  RelatedEvent,
} from "./types";

/**
 * Fetches user profile data from Primal API and converts to User type for trust scoring
 */
export async function fetchUserProfile(pubkey: string): Promise<User | null> {
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
      const eventData: unknown = item[2] as unknown;
      if (
        !eventData ||
        typeof eventData !== "object" ||
        Array.isArray(eventData)
      )
        continue;
      const event = eventData as { kind?: number; content?: string };
      if (!event) continue;

      if (event.kind === 0) {
        profileEvent = event;
      } else if (event.kind === 10000105) {
        statsEvent = event;
      }
    }

    // Parse profile data
    let profile: GiveawayProfile = {};
    if (profileEvent?.content) {
      try {
        profile = JSON.parse(profileEvent.content) as GiveawayProfile;
      } catch (e) {
        // Log but continue with empty profile
        const { logWarning } = await import("~/lib/error-logger.server");
        logWarning("Failed to parse profile content", {
          pubkey,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Parse stats data
    let stats: GiveawayStats = {};
    if (statsEvent?.content) {
      try {
        stats = JSON.parse(statsEvent.content) as GiveawayStats;
      } catch (e) {
        // Log but continue with empty stats
        const { logWarning } = await import("~/lib/error-logger.server");
        logWarning("Failed to parse stats content", {
          pubkey,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Convert to User type
    const profileTyped = profile as {
      name?: unknown;
      display_name?: unknown;
      about?: unknown;
      picture?: unknown;
      nip05?: unknown;
      lud16?: unknown;
    };
    const statsTyped = stats as {
      follows_count?: unknown;
      followers_count?: unknown;
      note_count?: unknown;
      reply_count?: unknown;
      time_joined?: unknown;
      total_zap_count?: unknown;
      total_satszapped?: unknown;
      media_count?: unknown;
    };
    const user: User = {
      pubkey,
      name: (profileTyped.name as string | undefined) ?? undefined,
      displayName:
        (profileTyped.display_name as string | undefined) ?? undefined,
      about: (profileTyped.about as string | undefined) ?? undefined,
      picture: (profileTyped.picture as string | undefined) ?? undefined,
      nip05: (profileTyped.nip05 as string | undefined) ?? undefined,
      lud16: (profileTyped.lud16 as string | undefined) ?? undefined,
      followsCount: (statsTyped.follows_count as number | undefined) ?? 0,
      followersCount: (statsTyped.followers_count as number | undefined) ?? 0,
      noteCount: (statsTyped.note_count as number | undefined) ?? 0,
      replyCount: (statsTyped.reply_count as number | undefined) ?? 0,
      timeJoined: (statsTyped.time_joined as number | undefined) ?? 0,
      zapCount: (statsTyped.total_zap_count as number | undefined) ?? 0,
      totalSatsZapped: (statsTyped.total_satszapped as number | undefined) ?? 0,
      mediaCount: (statsTyped.media_count as number | undefined) ?? 0,
    };

    return user;
  } catch (error) {
    // Log error but return null (non-critical - just means we can't calculate trust score)
    const { ExternalServiceError } = await import("~/lib/errors");
    const { logError } = await import("~/lib/error-logger.server");

    const serviceError = new ExternalServiceError(
      `Failed to fetch user profile for ${pubkey}`,
      502,
      {
        service: "PrimalCache",
        pubkey,
        originalError: error instanceof Error ? error.message : String(error),
      },
    );

    logError(serviceError, { pubkey });
    return null;
  }
}

/**
 * Fetch post stats from Primal cache
 */
async function fetchPostStats(eventIds: string[]): Promise<
  Record<
    string,
    {
      likes: number;
      replies: number;
      mentions: number;
      reposts: number;
      zaps: number;
      satszapped: number;
    }
  >
> {
  if (eventIds.length === 0) {
    return {};
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Fetch stats for each event ID
    const statsPromises = eventIds.map(async (eventId) => {
      // Read directly from process.env to support test environment changes
      const primalUrl = process.env.PRIMAL_CACHING_URL;
      if (!primalUrl) {
        throw new Error("PRIMAL_CACHING_URL environment variable is not set");
      }
      const response = await fetch(primalUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "thread_view",
          params: {
            event_id: eventId,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }

      const data = (await response.json()) as PrimalEvent[];
      // Find the stats event in the response array
      const statsEvent = data.find((event: PrimalEvent) => {
        if (!Array.isArray(event) || event[0] !== "EVENT" || !event[2])
          return false;
        const eventData = event[2];
        if (
          !eventData ||
          typeof eventData !== "object" ||
          Array.isArray(eventData)
        )
          return false;
        const eventTyped = eventData as { kind?: number; content?: string };
        return (
          eventTyped.kind === 10000100 &&
          eventTyped.content &&
          typeof eventTyped.content === "string" &&
          eventTyped.content.includes(eventId)
        );
      });

      if (
        statsEvent &&
        Array.isArray(statsEvent) &&
        statsEvent[2] &&
        typeof statsEvent[2] === "object" &&
        !Array.isArray(statsEvent[2])
      ) {
        const eventData = statsEvent[2] as { kind?: number; content?: string };
        if (eventData.content && typeof eventData.content === "string") {
          const content = JSON.parse(eventData.content) as {
            likes?: number;
            replies?: number;
            mentions?: number;
            reposts?: number;
            zaps?: number;
            satszapped?: number;
          };
          return {
            [eventId]: {
              likes: content.likes ?? 0,
              replies: content.replies ?? 0,
              mentions: content.mentions ?? 0,
              reposts: content.reposts ?? 0,
              zaps: content.zaps ?? 0,
              satszapped: content.satszapped ?? 0,
            },
          };
        }
      }

      return {
        [eventId]: {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        },
      };
    });

    const statsResults = await Promise.all(statsPromises);
    const stats = statsResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
    clearTimeout(timeoutId);
    return stats;
  } catch (error) {
    // Use centralized error handling but provide safe defaults
    const { ExternalServiceError } = await import("~/lib/errors");
    const { logError } = await import("~/lib/error-logger.server");

    // Log the error but continue with empty stats
    const serviceError = new ExternalServiceError(
      "Failed to fetch stats from Primal cache",
      502,
      {
        service: "PrimalCache",
        eventIdsCount: eventIds.length,
        originalError: error instanceof Error ? error.message : String(error),
      },
    );

    logError(serviceError, { eventIdsCount: eventIds.length, userId: "" });

    // Initialize empty stats object with 0 values for each post
    return eventIds.reduce(
      (acc, eventId) => {
        acc[eventId] = {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        };
        return acc;
      },
      ((): Record<
        string,
        {
          likes: number;
          replies: number;
          mentions: number;
          reposts: number;
          zaps: number;
          satszapped: number;
        }
      > => ({}))(),
    );
  }
}

/**
 * Filter and process giveaway participants
 */
async function processGiveawayParticipants(
  relatedEvents: RelatedEvent[],
  userId: string,
  user: {
    id: string;
    npub?: string;
    filterMuted?: boolean;
    mutedList?: { npubs?: string[] };
    [key: string]: unknown;
  },
): Promise<RelatedEvent[]> {
  if (relatedEvents.length === 0) {
    return [];
  }

  // Filter relatedEvents to only include unique pubkeys
  const uniquePubkeys = new Set();
  const uniqueRelatedEvents = relatedEvents.filter((event) => {
    if (!uniquePubkeys.has(event.pubkey)) {
      uniquePubkeys.add(event.pubkey);
      return true;
    }
    return false;
  });

  // Get blacklisted pubkeys
  const blacklistedPubkeys = await getGiveawayBlacklist(userId);
  const blacklistedSet = new Set(
    blacklistedPubkeys.map((pubkey) => {
      return convertToHex(pubkey) ?? pubkey;
    }),
  );

  // Get muted pubkeys if filtering is enabled
  const mutedSet = new Set<string>();
  if (
    user.filterMuted &&
    user.mutedList?.npubs &&
    Array.isArray(user.mutedList.npubs)
  ) {
    user.mutedList.npubs.forEach((pubkey: string) => {
      mutedSet.add(pubkey);
    });
  }

  // Filter relatedEvents to only include users with valid lud16 address and totalZapped > 5
  const filteredRelatedEvents: RelatedEvent[] = [];

  // Process events in parallel with Promise.all
  const profilePromises = uniqueRelatedEvents.map(async (event) => {
    try {
      // Skip blacklisted pubkeys
      if (blacklistedSet.has(event.pubkey)) {
        return null;
      }

      // Skip muted pubkeys
      if (mutedSet.has(event.pubkey)) {
        return null;
      }

      // Fetch user profile data
      const userProfileResponse = await connectToPrimalCache("user_profile", {
        pubkey: event.pubkey,
      });

      // Find user profile event (kind 0)
      const userProfile = (userProfileResponse as PrimalEvent[]).find(
        (data: PrimalEvent) => {
          if (!Array.isArray(data) || data[0] !== "EVENT" || !data[2])
            return false;
          const eventData = data[2];
          if (
            !eventData ||
            typeof eventData !== "object" ||
            Array.isArray(eventData)
          )
            return false;
          const eventTyped = eventData as { kind?: number };
          return eventTyped.kind === 0;
        },
      );

      // Find stats event (kind 10000105)
      const statsEvent = (userProfileResponse as PrimalEvent[]).find(
        (data: PrimalEvent) => {
          if (!Array.isArray(data) || data[0] !== "EVENT" || !data[2])
            return false;
          const eventData = data[2];
          if (
            !eventData ||
            typeof eventData !== "object" ||
            Array.isArray(eventData)
          )
            return false;
          const eventTyped = eventData as { kind?: number };
          return eventTyped.kind === 10000105;
        },
      );

      let lud16 = null;
      let totalZapped = 0;

      // Extract lud16 from profile
      if (userProfile && Array.isArray(userProfile) && userProfile[2]) {
        const profileEvent = userProfile[2] as { content?: string };
        if (profileEvent.content && typeof profileEvent.content === "string") {
          const profileContent = JSON.parse(profileEvent.content) as {
            lud16?: string;
          };
          lud16 = profileContent.lud16 ?? null;
        }
      }

      // Extract zap stats
      if (statsEvent && Array.isArray(statsEvent) && statsEvent[2]) {
        const statsEventData = statsEvent[2] as { content?: string };
        if (
          statsEventData.content &&
          typeof statsEventData.content === "string"
        ) {
          const stats = JSON.parse(statsEventData.content) as {
            total_zap_count?: number;
          };
          totalZapped = stats.total_zap_count ?? 0;
        }
      }

      // Only include users with valid lud16 and totalZapped > 5
      if (lud16 && totalZapped > 5) {
        return event;
      }
      return null;
    } catch (_error) {
      return null;
    }
  });

  // Wait for all promises to resolve and filter out null results
  const results = await Promise.all(profilePromises);
  filteredRelatedEvents.push(...results.filter((result) => result !== null));

  // Filter by trust score if hidePostsFromLowTrustUsers is enabled
  if (user.hidePostsFromLowTrustUsers) {
    // Fetch trust scores for all participants
    const trustScorePromises = filteredRelatedEvents.map(async (event) => {
      const userProfile = await fetchUserProfile(event.pubkey);
      if (userProfile) {
        const trustScore = calculateTrustScore(userProfile);
        return { event, trustScore };
      }
      return { event, trustScore: 0 }; // Default to 0 if profile fetch fails
    });

    const trustScoreResults = await Promise.all(trustScorePromises);

    // Filter out users with trust score < 40
    return trustScoreResults
      .filter(({ trustScore }) => trustScore >= 40)
      .map(({ event }) => event);
  }

  return filteredRelatedEvents;
}

/**
 * Load giveaway dashboard data
 */
export async function loadGiveawayData(
  userId: string,
  queueType: string,
  days: number,
) {
  const [posts, user, queueTypes] = await Promise.all([
    getRecentPostedPosts({
      userId,
      days,
      queueType,
    }),
    getUserById(userId),
    getQueueTypes(userId),
  ]);

  // Get event IDs from signedEvent.id
  const eventIds = posts
    .filter(
      (post) =>
        post.signedEvent &&
        typeof post.signedEvent === "object" &&
        "id" in post.signedEvent,
    )
    .map((post) => {
      const signedEvent = post.signedEvent as { id: string };
      return signedEvent.id;
    });

  // Fetch stats
  const stats = await fetchPostStats(eventIds);

  // Convert PostWithQueueType[] to PostData[] first
  const postsData: PostData[] = posts.map((post) => {
    const { queueType, ...rest } = post;
    const signedEventValue: PostData["signedEvent"] =
      post.signedEvent as PostData["signedEvent"];
    const nostrEventValue: PostData["nostrEvent"] =
      post.nostrEvent as PostData["nostrEvent"];
    const result: PostData = {
      ...rest,
      queueType: convertPrismaQueueTypeToQueueType(queueType),
      signedEvent: signedEventValue,
      nostrEvent: nostrEventValue,
    };
    return result;
  });

  // Add total engagement to each post
  const postsWithEngagement = postsData.map((post) => {
    const eventId =
      post.signedEvent &&
      typeof post.signedEvent === "object" &&
      "id" in post.signedEvent
        ? (post.signedEvent as { id: string }).id
        : null;
    const postStats = eventId
      ? (stats[eventId] ?? {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        })
      : {
          likes: 0,
          replies: 0,
          mentions: 0,
          reposts: 0,
          zaps: 0,
          satszapped: 0,
        };

    const totalEngagement =
      postStats.likes +
      postStats.replies +
      postStats.mentions +
      postStats.reposts +
      postStats.zaps;

    return {
      ...post,
      stats: postStats,
      totalEngagement,
    };
  });

  // Filter posts with engagement
  const postsWithNonZeroEngagement = postsWithEngagement.filter(
    (post) => post.totalEngagement > 0,
  );

  // Extract all post IDs into an array
  const postIds = postsWithNonZeroEngagement
    .map((post) => {
      if (
        post.signedEvent &&
        typeof post.signedEvent === "object" &&
        "id" in post.signedEvent
      ) {
        return (post.signedEvent as { id: string }).id;
      }
      return null;
    })
    .filter((id): id is string => id !== null);

  // Handle case when there are no posts with engagement
  let relatedEvents: RelatedEvent[] = [];
  if (postIds.length > 0) {
    const result = await fetchGiveawayParticipants(postIds);
    relatedEvents = result.relatedEvents;
  }

  // Process and filter participants
  if (!user) {
    throw new Error("User not found");
  }

  // Ensure user has required properties with safe defaults
  const userWithDefaults = {
    ...user,
    id: user.id,
    npub: user.npub ?? "",
    filterMuted: user.filterMuted ?? false,
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

  const processedEvents = await processGiveawayParticipants(
    relatedEvents,
    userId,
    userWithDefaults,
  );

  // Serialize Date objects to strings for Remix loader response
  // Note: postsWithNonZeroEngagement has additional fields (stats, totalEngagement)
  // We need to preserve those while serializing dates
  const postsDTO: PostDTO[] = toPostDTOArray(
    postsWithNonZeroEngagement.map(({ stats: _stats, totalEngagement: _totalEngagement, ...post }) => post),
  );

  // Re-add the engagement fields to DTOs
  const postsWithEngagementDTO = postsDTO.map((dto, index) => ({
    ...dto,
    stats: postsWithNonZeroEngagement[index]?.stats ?? {
      likes: 0,
      replies: 0,
      mentions: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
    },
    totalEngagement: postsWithNonZeroEngagement[index]?.totalEngagement ?? 0,
  }));

  return {
    posts: postsWithEngagementDTO,
    stats,
    relatedEvents: processedEvents,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
  };
}
