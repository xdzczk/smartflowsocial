/**
 * Shared Nostr social graph helpers (kind 3 follow lists, followers via cache).
 * Used by engagement feed, giveaways, and broadcasts.
 */

import { fetchFromCache } from "~/features/cache";

export interface SocialGraphFetchResult {
  pubkeys: string[];
  /** True when the cache request threw (e.g. upstream 500); false when empty is a real empty graph. */
  fetchFailed: boolean;
}

async function fetchKind3FollowingPubkeys(
  userPubkeyHex: string
): Promise<SocialGraphFetchResult> {
  try {
    const responses = await fetchFromCache("event_by_addr", {
      kind: 3,
      pubkey: userPubkeyHex,
      identifier: "",
    });
    if (!Array.isArray(responses) || responses.length === 0) {
      return { pubkeys: [], fetchFailed: false };
    }
    for (const item of responses) {
      if (!Array.isArray(item) || item[0] !== "EVENT" || !item[2]) continue;
      const ev = item[2] as { kind?: number; tags?: string[][] };
      if (ev.kind !== 3 || !Array.isArray(ev.tags)) continue;
      return {
        pubkeys: ev.tags.flatMap((t) =>
          Array.isArray(t) && t[0] === "p" && typeof t[1] === "string"
            ? [t[1].toLowerCase()]
            : []
        ),
        fetchFailed: false,
      };
    }
    return { pubkeys: [], fetchFailed: false };
  } catch {
    return { pubkeys: [], fetchFailed: true };
  }
}

async function fetchFollowersPubkeys(
  userPubkeyHex: string
): Promise<SocialGraphFetchResult> {
  try {
    const responses = await fetchFromCache("get_followers", {
      pubkey: userPubkeyHex,
      limit: 5000,
    });
    if (!Array.isArray(responses) || responses.length === 0) {
      return { pubkeys: [], fetchFailed: false };
    }
    const pubkeys: string[] = [];
    for (const item of responses) {
      if (!Array.isArray(item) || item[0] !== "EVENT" || !item[2]) continue;
      const ev = item[2] as { pubkey?: string; kind?: number };
      if (ev.kind !== 3 || typeof ev.pubkey !== "string") continue;
      pubkeys.push(ev.pubkey.toLowerCase());
    }
    return { pubkeys: [...new Set(pubkeys)], fetchFailed: false };
  } catch {
    return { pubkeys: [], fetchFailed: true };
  }
}

/**
 * Fetch the user's follow list (kind 3 contacts) and return hex pubkeys.
 * Returns [] if not available or on error (errors are swallowed for read-only callers).
 */
export async function getFollowedPubkeys(
  userPubkeyHex: string
): Promise<string[]> {
  const r = await fetchKind3FollowingPubkeys(userPubkeyHex);
  return r.pubkeys;
}

/**
 * Same as {@link getFollowedPubkeys} but exposes whether the cache request failed.
 */
export async function getFollowedPubkeysGraph(
  userPubkeyHex: string
): Promise<SocialGraphFetchResult> {
  return fetchKind3FollowingPubkeys(userPubkeyHex);
}

/**
 * Fetch pubkeys of users who follow the given pubkey (kind 3 events that reference pubkey in "p" tag).
 * Returns [] if not available or on error.
 */
export async function getFollowerPubkeys(
  userPubkeyHex: string
): Promise<string[]> {
  const r = await fetchFollowersPubkeys(userPubkeyHex);
  return r.pubkeys;
}

/**
 * Same as {@link getFollowerPubkeys} but exposes whether the cache request failed.
 */
export async function getFollowerPubkeysGraph(
  userPubkeyHex: string
): Promise<SocialGraphFetchResult> {
  return fetchFollowersPubkeys(userPubkeyHex);
}

/**
 * Mutual follow pubkeys: intersection of following and followers (lowercase hex).
 */
export async function getMutualPubkeys(
  userPubkeyHex: string
): Promise<string[]> {
  const r = await getMutualPubkeysGraph(userPubkeyHex);
  return r.pubkeys;
}

/**
 * Mutual follows with cache failure metadata (either list failing counts as fetch failure).
 */
export async function getMutualPubkeysGraph(
  userPubkeyHex: string
): Promise<SocialGraphFetchResult> {
  const [following, followers] = await Promise.all([
    fetchKind3FollowingPubkeys(userPubkeyHex),
    fetchFollowersPubkeys(userPubkeyHex),
  ]);
  const followerSet = new Set(followers.pubkeys);
  return {
    pubkeys: following.pubkeys.filter((p) => followerSet.has(p)),
    fetchFailed: following.fetchFailed || followers.fetchFailed,
  };
}
