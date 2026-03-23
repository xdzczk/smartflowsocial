import type { BroadcastAudienceType } from "@prisma/client";

import {
  getFollowedPubkeysGraph,
  getFollowerPubkeysGraph,
  getMutualPubkeysGraph,
} from "~/features/nostr/social-graph.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

const HEX64 = /^[0-9a-f]{64}$/i;

export function normalizePubkeyInput(line: string): string | null {
  const s = line.trim();
  if (!s) return null;
  if (HEX64.test(s)) return s.toLowerCase();
  const decoded = nostrAdapter.decodeNpub(s);
  if (decoded && HEX64.test(decoded)) return decoded.toLowerCase();
  return null;
}

export function parseCustomNpubLines(lines: string[]): {
  valid: string[];
  invalid: number;
} {
  const seen = new Set<string>();
  const valid: string[] = [];
  let invalid = 0;
  for (const line of lines) {
    const p = normalizePubkeyInput(line);
    if (!p) {
      if (line.trim()) invalid += 1;
      continue;
    }
    if (seen.has(p)) continue;
    seen.add(p);
    valid.push(p);
  }
  return { valid, invalid };
}

export async function resolveAudiencePubkeys(input: {
  audienceType: BroadcastAudienceType;
  customLines: string[];
  senderPubkeyHex: string;
}): Promise<{
  pubkeys: string[];
  invalidCustom: number;
  /** Custom list: recipients not in your follower graph (counted in invalidCustom). */
  excludedNonFollowers?: number;
  /** Present for graph-backed audiences; true if cache failed (not “empty graph”). */
  graphFetchFailed?: boolean;
}> {
  if (input.audienceType === "CUSTOM") {
    const { valid, invalid } = parseCustomNpubLines(input.customLines);
    const { pubkeys: followerPubkeys, fetchFailed } =
      await getFollowerPubkeysGraph(input.senderPubkeyHex);
    if (fetchFailed) {
      return {
        pubkeys: [],
        invalidCustom: invalid,
        excludedNonFollowers: valid.length,
        graphFetchFailed: true,
      };
    }
    const followerSet = new Set(followerPubkeys.map((p) => p.toLowerCase()));
    const filtered = valid.filter((p) => followerSet.has(p.toLowerCase()));
    const excludedNonFollowers = valid.length - filtered.length;
    return {
      pubkeys: filtered,
      invalidCustom: invalid + excludedNonFollowers,
      excludedNonFollowers,
      graphFetchFailed: false,
    };
  }
  if (input.audienceType === "FOLLOWING") {
    const { pubkeys, fetchFailed } = await getFollowedPubkeysGraph(
      input.senderPubkeyHex
    );
    return { pubkeys, invalidCustom: 0, graphFetchFailed: fetchFailed };
  }
  if (input.audienceType === "FOLLOWERS") {
    const { pubkeys, fetchFailed } = await getFollowerPubkeysGraph(
      input.senderPubkeyHex
    );
    return { pubkeys, invalidCustom: 0, graphFetchFailed: fetchFailed };
  }
  const { pubkeys, fetchFailed } = await getMutualPubkeysGraph(
    input.senderPubkeyHex
  );
  return { pubkeys, invalidCustom: 0, graphFetchFailed: fetchFailed };
}

export function applySuppressionAndSelf(input: {
  pubkeys: string[];
  selfPubkeyHex: string;
  suppressed: Set<string>;
}): {
  included: string[];
  suppressedCount: number;
  selfSkipped: boolean;
} {
  const selfLower = input.selfPubkeyHex.toLowerCase();
  let suppressedCount = 0;
  let selfSkipped = false;
  const included: string[] = [];
  for (const p of input.pubkeys) {
    const pl = p.toLowerCase();
    if (pl === selfLower) {
      selfSkipped = true;
      continue;
    }
    if (input.suppressed.has(pl)) {
      suppressedCount += 1;
      continue;
    }
    included.push(pl);
  }
  return { included, suppressedCount, selfSkipped };
}
