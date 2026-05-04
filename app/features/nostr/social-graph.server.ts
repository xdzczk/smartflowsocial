/**
 * Shared Nostr social graph helpers (kind 3 follow lists, followers via cache).
 * Uses Primal caching-service RPC names from `App.exposed_functions` (e.g. `contact_list`,
 * `user_followers`, `mutual_follows`)  -  not legacy names like `event_by_addr` / `get_followers`.
 */

import { fetchFromCache } from "~/features/cache";

export interface SocialGraphFetchResult {
  pubkeys: string[];
  /** True when the cache request threw (e.g. upstream 500); false when empty is a real empty graph. */
  fetchFailed: boolean;
}

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * Pubkeys from Primal ["EVENT", subId, ev] frames (e.g. kind 0 metadata from `user_followers`).
 */
function pubkeysFromCacheEventMessages(responses: unknown[]): string[] {
  const out: string[] = [];
  for (const item of responses) {
    if (!Array.isArray(item) || item[0] !== "EVENT" || !item[2]) continue;
    const ev = item[2] as { pubkey?: string };
    if (typeof ev.pubkey !== "string") continue;
    const pk = ev.pubkey.toLowerCase();
    if (!HEX64.test(pk)) continue;
    out.push(pk);
  }
  return [...new Set(out)];
}

/** `p` tags from the first kind 3 event in a cache response (contact list). */
function pubkeysFromKind3ContactList(responses: unknown[]): string[] {
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
  return [];
}

async function fetchKind3FollowingPubkeys(
  userPubkeyHex: string
): Promise<SocialGraphFetchResult> {
  try {
    const responses = await fetchFromCache("contact_list", {
      pubkey: userPubkeyHex,
      extended_response: false,
    });
    if (!Array.isArray(responses) || responses.length === 0) {
      return { pubkeys: [], fetchFailed: false };
    }
    return {
      pubkeys: pubkeysFromKind3ContactList(responses),
      fetchFailed: false,
    };
  } catch {
    return { pubkeys: [], fetchFailed: true };
  }
}

async function fetchFollowersPubkeys(
  userPubkeyHex: string
): Promise<SocialGraphFetchResult> {
  try {
    const responses = await fetchFromCache("user_followers", {
      pubkey: userPubkeyHex,
      limit: 1000,
    });
    if (!Array.isArray(responses) || responses.length === 0) {
      return { pubkeys: [], fetchFailed: false };
    }
    return {
      pubkeys: pubkeysFromCacheEventMessages(responses),
      fetchFailed: false,
    };
  } catch {
    return { pubkeys: [], fetchFailed: true };
  }
}

async function fetchMutualPubkeys(
  userPubkeyHex: string
): Promise<SocialGraphFetchResult> {
  try {
    const responses = await fetchFromCache("mutual_follows", {
      pubkey: userPubkeyHex,
      user_pubkey: userPubkeyHex,
    });
    if (!Array.isArray(responses) || responses.length === 0) {
      return { pubkeys: [], fetchFailed: false };
    }
    return {
      pubkeys: pubkeysFromCacheEventMessages(responses),
      fetchFailed: false,
    };
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
 * Fetch pubkeys of users who follow the given user (via Primal `user_followers`).
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
 * Mutual follow pubkeys (Primal `mutual_follows` with pubkey === user_pubkey).
 */
export async function getMutualPubkeys(
  userPubkeyHex: string
): Promise<string[]> {
  const r = await getMutualPubkeysGraph(userPubkeyHex);
  return r.pubkeys;
}

/**
 * Mutual follows with cache failure metadata.
 */
export async function getMutualPubkeysGraph(
  userPubkeyHex: string
): Promise<SocialGraphFetchResult> {
  return fetchMutualPubkeys(userPubkeyHex);
}
