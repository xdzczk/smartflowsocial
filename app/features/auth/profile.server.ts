import { nip19 } from "nostr-tools";

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import type {
  CompleteProfileResult,
  GetCompleteProfileParams,
  MediaData,
  PrimalEvent,
  ProcessedProfile,
  ProfileData,
  StatsData,
} from "~/features/nostr/types";
import type { UserWithHashTagPresets } from "~/features/user";
import { createUser, getUserById } from "~/features/user";
import { logError } from "~/lib/error-logger.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

/**
 * Validates an npub string
 */
export function validateNpub(npub: string): boolean {
  try {
    const { type } = nip19.decode(npub);
    return type === "npub";
  } catch (_e) {
    return false;
  }
}

/**
 * Fetches profile data from Primal cache (HTTP proxy or WebSocket per PRIMAL_CACHING_URL).
 */
export async function fetchPrimalProfileData(
  npub: string
): Promise<PrimalEvent[]> {
  try {
    const pubkey = nostrAdapter.decodeNpub(npub);
    const responses = await connectToPrimalCache("user_profile", {
      pubkey,
    });
    return responses as PrimalEvent[];
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Failed to fetch profile data from Primal cache",
      npub,
    });
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
      Array.isArray(event) && event[0] === "EVENT" && event[2].kind === 0
  );

  // Find the stats event (kind 10000105)
  const statsEvent = data.find(
    (event) =>
      Array.isArray(event) && event[0] === "EVENT" && event[2].kind === 10000105
  );

  // Find the media resources event (kind 10000119)
  const mediaEvent = data.find(
    (event) =>
      Array.isArray(event) && event[0] === "EVENT" && event[2].kind === 10000119
  );

  // Parse profile content
  const profile: ProfileData = profileEvent
    ? (JSON.parse(profileEvent[2].content) as ProfileData)
    : {};

  // Parse stats content
  const stats: StatsData = statsEvent
    ? (JSON.parse(statsEvent[2].content) as StatsData)
    : {};

  // Parse media content
  const media: MediaData = mediaEvent
    ? (JSON.parse(mediaEvent[2].content) as MediaData)
    : {};

  return {
    profile: {
      ...profile,
      followers_count: stats.followers_count ?? 0,
      following_count: stats.follows_count ?? 0,
      posts_count: stats.note_count ?? 0,
      zaps_count: stats.total_zap_count ?? 0,
      total_satszapped: stats.total_satszapped ?? 0,
      media,
    },
  };
}

export async function getCompleteProfile({
  npub,
}: GetCompleteProfileParams): Promise<CompleteProfileResult> {
  const primalData = await fetchPrimalProfileData(npub);

  // If no data returned, return empty profile
  if (primalData.length === 0) {
    const emptyProfile: ProcessedProfile = {
      followers_count: 0,
      following_count: 0,
      posts_count: 0,
      zaps_count: 0,
      total_satszapped: 0,
      media: {},
    };
    return {
      nostrProfile: emptyProfile,
      lud16: undefined,
    };
  }

  const { profile } = processPrimalData(primalData);

  return {
    nostrProfile: profile,
    lud16: profile.lud16,
  };
}

/** True if stored profile has no picture and no name/display_name (UI shows "U" and npub). */
function isProfileEmpty(nostrProfile: unknown): boolean {
  if (nostrProfile == null) return true;
  let p: Record<string, unknown>;
  if (typeof nostrProfile === "string") {
    try {
      p = JSON.parse(nostrProfile) as Record<string, unknown>;
    } catch {
      return true;
    }
  } else if (typeof nostrProfile === "object" && !Array.isArray(nostrProfile)) {
    p = nostrProfile as Record<string, unknown>;
  } else {
    return true;
  }
  const picture = p["picture"];
  const name = p["name"];
  const displayName = p["display_name"];
  return (
    (picture == null || String(picture).trim() === "") &&
    (name == null || String(name).trim() === "") &&
    (displayName == null || String(displayName).trim() === "")
  );
}

/**
 * If the user's stored profile has no picture/name, fetches from Primal cache and updates the user.
 * Use in root loader so existing users (e.g. logged in before profile fetch worked) get profile on next load.
 */
export async function refreshUserProfileIfEmpty(
  user: UserWithHashTagPresets
): Promise<UserWithHashTagPresets> {
  if (!isProfileEmpty(user.nostrProfile)) return user;

  const { nostrProfile } = await getCompleteProfile({ npub: user.npub });
  const p = nostrProfile as Record<string, unknown>;
  const picture = p["picture"] != null && String(p["picture"]).trim() !== "";
  const name = p["name"] != null && String(p["name"]).trim() !== "";
  const displayName =
    p["display_name"] != null && String(p["display_name"]).trim() !== "";
  if (!picture && !name && !displayName) return user;

  await createUser(user.npub, JSON.stringify(nostrProfile));
  const updated = await getUserById(user.id);
  return updated ?? user;
}
