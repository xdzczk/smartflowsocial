/**
 * Giveaway loader data preparation
 * Centralized data fetching and processing for giveaway page
 */

import { connectToPrimalCache } from "~/lib/nostrwebsocket.server";
import { getRecentPostedPosts } from "~/models/post.server";
import {
  getGiveawayBlacklist,
  getUserById,
  getQueueTypes,
} from "~/models/user.server";
import { fetchGiveawayParticipants } from "./giveaway.server";
import { calculateTrustScore, type User } from "~/features/engagement/trustScore";
import { convertToHex } from "~/lib/helpers";

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
    let profile: GiveawayProfile = {};
    if (profileEvent && profileEvent.content) {
      try {
        profile = JSON.parse(profileEvent.content);
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
    if (statsEvent && statsEvent.content) {
      try {
        stats = JSON.parse(statsEvent.content);
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
async function fetchPostStats(eventIds: string[]): Promise<Record<string, any>> {
  if (eventIds.length === 0) {
    return {};
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Fetch stats for each event ID
    const statsPromises = eventIds.map(async (eventId) => {
      const response = await fetch(process.env.PRIMAL_CACHING_URL, {
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

      const data = await response.json();
      // Find the stats event in the response array
      const statsEvent = data.find(
        (event: PrimalEvent) =>
          event[0] === "EVENT" &&
          event[2] &&
          event[2].kind === 10000100 &&
          event[2].content &&
          event[2].content.includes(eventId),
      );

      if (statsEvent) {
        const content = JSON.parse(statsEvent[2].content);
        return {
          [eventId]: {
            likes: content.likes || 0,
            replies: content.replies || 0,
            mentions: content.mentions || 0,
            reposts: content.reposts || 0,
            zaps: content.zaps || 0,
            satszapped: content.satszapped || 0,
          },
        };
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
    return eventIds.reduce((acc, eventId) => {
      acc[eventId] = {
        likes: 0,
        replies: 0,
        mentions: 0,
        reposts: 0,
        zaps: 0,
        satszapped: 0,
      };
      return acc;
    }, {} as Record<string, any>);
  }
}

/**
 * Filter and process giveaway participants
 */
async function processGiveawayParticipants(
  relatedEvents: RelatedEvent[],
  userId: string,
  user: { id: string; npub?: string; filterMuted?: boolean; mutedList?: { npubs?: string[] }; [key: string]: unknown },
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
      return convertToHex(pubkey) || pubkey;
    }),
  );

  // Get muted pubkeys if filtering is enabled
  const mutedSet = new Set<string>();
  if (user.filterMuted && user.mutedList?.npubs && Array.isArray(user.mutedList.npubs)) {
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
      const userProfile = userProfileResponse.find(
        (data: PrimalEvent) => data[0] === "EVENT" && data[2].kind === 0,
      );

      // Find stats event (kind 10000105)
      const statsEvent = userProfileResponse.find(
        (data: PrimalEvent) => data[0] === "EVENT" && data[2].kind === 10000105,
      );

      let lud16 = null;
      let totalZapped = 0;

      // Extract lud16 from profile
      if (userProfile && Array.isArray(userProfile) && userProfile[2]) {
        const profileEvent = userProfile[2] as GiveawayProfile;
        if (profileEvent.content) {
          const profileContent = JSON.parse(profileEvent.content);
          lud16 = profileContent.lud16;
        }
      }

      // Extract zap stats
      if (statsEvent && Array.isArray(statsEvent) && statsEvent[2]) {
        const statsEventData = statsEvent[2] as GiveawayStats;
        if (statsEventData.content) {
          const stats = JSON.parse(statsEventData.content);
          totalZapped = stats.total_zap_count ?? 0;
        }
      }

      // Only include users with valid lud16 and totalZapped > 5
      if (lud16 && totalZapped > 5) {
        return event;
      }
      return null;
    } catch (error) {
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
    .filter((post) => post.signedEvent && typeof post.signedEvent === "object" && "id" in post.signedEvent)
    .map((post) => {
      const signedEvent = post.signedEvent as { id: string };
      return signedEvent.id;
    });

  // Fetch stats
  const stats = await fetchPostStats(eventIds);

  // Add total engagement to each post
  const postsWithEngagement = posts.map((post) => {
    const eventId = post.signedEvent && typeof post.signedEvent === "object" && "id" in post.signedEvent
      ? (post.signedEvent as { id: string }).id
      : null;
    const postStats = eventId ? (stats[eventId] || {
      likes: 0,
      replies: 0,
      mentions: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
    }) : {
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
      if (post.signedEvent && typeof post.signedEvent === "object" && "id" in post.signedEvent) {
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
  const processedEvents = await processGiveawayParticipants(
    relatedEvents,
    userId,
    user,
  );

  return {
    posts: postsWithNonZeroEngagement,
    stats,
    relatedEvents: processedEvents,
    user,
    queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
    selectedQueueType: queueType,
  };
}

