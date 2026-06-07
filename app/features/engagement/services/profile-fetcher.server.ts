/**
 * Profile fetching service
 * Fetches user profile data from Primal API and converts to User type for trust scoring
 */

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import { logError } from "~/lib/error-logger.server";

import { calculateTrustScore, type User } from "../trust-score";
import type { EngagementProfile, EngagementStats } from "../types";

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
      const rawEventData: unknown = item[2] as unknown;
      if (
        !rawEventData ||
        typeof rawEventData !== "object" ||
        Array.isArray(rawEventData)
      )
        continue;
      const event: { kind?: number; content?: string } = rawEventData;

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
 * Fetch user profiles for multiple pubkeys and calculate trust scores
 */
export async function fetchUserProfilesWithTrustScores(
  pubkeys: string[]
): Promise<{
  userProfilesMap: Map<string, User>;
  trustScoresMap: Map<string, number>;
}> {
  const userProfilesMap = new Map<string, User>();
  const trustScoresMap = new Map<string, number>();

  const profilePromises = pubkeys.map(async (pubkey) => {
    const userProfile = await fetchUserProfile(pubkey);
    if (userProfile) {
      userProfilesMap.set(pubkey, userProfile);
      const trustScore = calculateTrustScore(userProfile);
      trustScoresMap.set(pubkey, trustScore);
    }
  });

  await Promise.all(profilePromises);

  return { userProfilesMap, trustScoresMap };
}
