import { nip19 } from "nostr-tools";

import type {
  CompleteProfileResult,
  GetCompleteProfileParams,
  MediaData,
  PrimalEvent,
  ProcessedProfile,
  ProfileData,
  StatsData,
} from "~/features/nostr/types";
import { npubToHex } from "~/lib/nostr";
import { connectToPrimalCache } from "~/lib/nostrwebsocket.server";

/**
 * Validates an npub string
 */
export function validateNpub(npub: string): boolean {
  try {
    const { type } = nip19.decode(npub);
    return type === "npub";
  } catch (e) {
    return false;
  }
}

/**
 * Fetches profile data from Primal API using WebSocket
 */
export async function fetchPrimalProfileData(
  npub: string,
): Promise<PrimalEvent[]> {
  try {
    const pubkey = npubToHex(npub);
    const responses = await connectToPrimalCache("user_profile", {
      pubkey,
    });
    return responses as PrimalEvent[];
  } catch (error) {
    console.error("Failed to fetch profile data from Primal cache:", error);
    // Return empty array to allow login to proceed without profile data
    return [];
  }
}

/**
 * Processes Primal API response to extract profile information
 */
export function processPrimalData(data: PrimalEvent[]): {
  profile: ProcessedProfile;
} {
  // Find the profile event (kind 0)
  const profileEvent = data.find(
    (event) =>
      Array.isArray(event) && event[0] === "EVENT" && event[2].kind === 0,
  );

  // Find the stats event (kind 10000105)
  const statsEvent = data.find(
    (event) =>
      Array.isArray(event) &&
      event[0] === "EVENT" &&
      event[2].kind === 10000105,
  );

  // Find the media resources event (kind 10000119)
  const mediaEvent = data.find(
    (event) =>
      Array.isArray(event) &&
      event[0] === "EVENT" &&
      event[2].kind === 10000119,
  );

  // Parse profile content
  const profile: ProfileData = profileEvent
    ? JSON.parse(profileEvent[2].content)
    : {};

  // Parse stats content
  const stats: StatsData = statsEvent ? JSON.parse(statsEvent[2].content) : {};

  // Parse media content
  const media: MediaData = mediaEvent ? JSON.parse(mediaEvent[2].content) : {};

  return {
    profile: {
      ...profile,
      followers_count: stats.followers_count || 0,
      following_count: stats.follows_count || 0,
      posts_count: stats.note_count || 0,
      zaps_count: stats.total_zap_count || 0,
      total_satszapped: stats.total_satszapped || 0,
      media,
    },
  };
}

export async function getCompleteProfile({
  npub,
}: GetCompleteProfileParams): Promise<CompleteProfileResult> {
  const primalData = await fetchPrimalProfileData(npub);
  
  // If no data returned, return empty profile
  if (!primalData || primalData.length === 0) {
    return {
      nostrProfile: {} as ProcessedProfile,
      lud16: undefined,
    };
  }
  
  const { profile } = processPrimalData(primalData);

  return {
    nostrProfile: profile,
    lud16: profile.lud16,
  };
}
