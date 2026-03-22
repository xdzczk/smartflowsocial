/**
 * Shared Nostr social graph helpers (kind 3 follow lists, followers via cache).
 * Used by engagement feed, giveaways, and broadcasts.
 */

import { fetchFromCache } from "~/features/cache";

/**
 * Fetch the user's follow list (kind 3 contacts) and return hex pubkeys.
 * Returns [] if not available or on error.
 */
export async function getFollowedPubkeys(
  userPubkeyHex: string
): Promise<string[]> {
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
          ? [t[1].toLowerCase()]
          : []
      );
    }
  } catch {
    // No follow list or cache error
  }
  return [];
}

/**
 * Fetch pubkeys of users who follow the given pubkey (kind 3 events that reference pubkey in "p" tag).
 * Returns [] if not available or on error. Requires cache support for "get_followers".
 */
export async function getFollowerPubkeys(
  userPubkeyHex: string
): Promise<string[]> {
  try {
    const responses = await fetchFromCache("get_followers", {
      pubkey: userPubkeyHex,
      limit: 5000,
    });
    if (!Array.isArray(responses) || responses.length === 0) return [];
    const pubkeys: string[] = [];
    for (const item of responses) {
      if (!Array.isArray(item) || item[0] !== "EVENT" || !item[2]) continue;
      const ev = item[2] as { pubkey?: string; kind?: number };
      if (ev.kind !== 3 || typeof ev.pubkey !== "string") continue;
      pubkeys.push(ev.pubkey.toLowerCase());
    }
    return [...new Set(pubkeys)];
  } catch {
    // get_followers not supported or cache error
  }
  return [];
}

/**
 * Mutual follow pubkeys: intersection of following and followers (lowercase hex).
 */
export async function getMutualPubkeys(
  userPubkeyHex: string
): Promise<string[]> {
  const [following, followers] = await Promise.all([
    getFollowedPubkeys(userPubkeyHex),
    getFollowerPubkeys(userPubkeyHex),
  ]);
  const followerSet = new Set(followers);
  return following.filter((p) => followerSet.has(p));
}
