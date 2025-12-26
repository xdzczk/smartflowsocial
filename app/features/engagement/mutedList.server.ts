import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import type { MutedListData, PrimalEvent } from "~/features/engagement/types";

// Re-export the type
export type { MutedListData } from "~/features/engagement/types";

/**
 * Get muted list for a user (alias for fetchMutedList)
 */
export const getMutedList = fetchMutedList;

/**
 * Update muted list for a user
 * Note: This function should be implemented based on your requirements
 */
export async function updateMutedList(
  pubkey: string,
  mutedList: MutedListData,
): Promise<MutedListData> {
  // TODO: Implement actual update logic
  // This is a placeholder that returns the provided muted list
  return mutedList;
}

/**
 * Fetches and parses the muted list for a user from Primal cache
 * @param pubkey - The user's public key (hex format)
 * @returns Object containing array of muted npubs and sync timestamp
 */
export async function fetchMutedList(
  pubkey: string,
): Promise<MutedListData | null> {
  try {
    const responses = await connectToPrimalCache("mutelist", {
      pubkey,
      extended_response: true,
    });

    if (!responses || responses.length === 0) {
      return null;
    }

    // Find the mute list event (kind 10000)
    const muteListEvent = (responses as PrimalEvent[]).find((res: PrimalEvent) => {
      if (Array.isArray(res) && res[0] === "EVENT" && res[2]) {
        return res[2].kind === 10000;
      }
      return false;
    });

    if (!muteListEvent || !Array.isArray(muteListEvent) || !muteListEvent[2]) {
      return {
        npubs: [],
        lastSynced: new Date().toISOString(),
      };
    }

    const event = muteListEvent[2];

    // Extract all "p" tags (muted public keys)
    const mutedNpubs: string[] = [];
    if (event.tags && Array.isArray(event.tags)) {
      for (const tag of event.tags) {
        if (Array.isArray(tag) && tag[0] === "p" && tag[1]) {
          mutedNpubs.push(tag[1]);
        }
      }
    }

    return {
      npubs: mutedNpubs,
      lastSynced: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[MutedList] Error fetching muted list:", error);
    throw error;
  }
}
