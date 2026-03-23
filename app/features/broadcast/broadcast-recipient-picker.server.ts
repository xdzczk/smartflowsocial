import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import {
  getFollowerPubkeysGraph,
  getMutualPubkeysGraph,
} from "~/features/nostr/social-graph.server";
import { getUserById } from "~/features/user";
import { logError } from "~/lib/error-logger.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";
import { prisma } from "~/lib/prisma.server";

import { resolveAudiencePubkeys } from "./broadcast-resolve.server";

const HEX64 = /^[0-9a-f]{64}$/i;
const PROFILE_CHUNK = 80;

export async function getBroadcastEligiblePoolPubkeys(
  userId: string,
  pool: "followers" | "mutuals"
): Promise<{ pubkeys: string[]; fetchFailed: boolean }> {
  const user = await getUserById(userId);
  if (!user?.npub) {
    return { pubkeys: [], fetchFailed: true };
  }
  const hex =
    nostrAdapter.decodeNpub(user.npub)?.toLowerCase() ??
    user.npub.toLowerCase();
  if (!HEX64.test(hex)) {
    return { pubkeys: [], fetchFailed: true };
  }
  if (pool === "followers") {
    return getFollowerPubkeysGraph(hex);
  }
  return getMutualPubkeysGraph(hex);
}

export interface BroadcastRecipientProfile {
  pubkey: string;
  name: string;
  picture: string | null;
  nip05: string | null;
}

function parseKind0FromResponses(
  responses: unknown[],
  wanted: Set<string>
): Map<string, BroadcastRecipientProfile> {
  const out = new Map<string, BroadcastRecipientProfile>();
  for (const item of responses) {
    if (!Array.isArray(item) || item[0] !== "EVENT" || !item[2]) continue;
    const ev = item[2] as {
      kind?: number;
      pubkey?: string;
      content?: string;
    };
    if (ev.kind !== 0 || typeof ev.pubkey !== "string") continue;
    const pk = ev.pubkey.toLowerCase();
    if (!wanted.has(pk)) continue;
    let name = `${pk.slice(0, 8)}…`;
    let picture: string | null = null;
    let nip05: string | null = null;
    try {
      if (typeof ev.content === "string") {
        const meta = JSON.parse(ev.content) as {
          name?: string;
          display_name?: string;
          picture?: string;
          nip05?: string;
        };
        const fromMeta =
          [meta.name?.trim(), meta.display_name?.trim()].find(
            (s) => s && s.length > 0
          ) ?? null;
        name = fromMeta ?? name;
        picture =
          typeof meta.picture === "string" && meta.picture.trim()
            ? meta.picture.trim()
            : null;
        nip05 =
          typeof meta.nip05 === "string" && meta.nip05.trim()
            ? meta.nip05.trim()
            : null;
      }
    } catch {
      // keep defaults
    }
    out.set(pk, { pubkey: pk, name, picture, nip05 });
  }
  return out;
}

export async function fetchBroadcastRecipientProfiles(
  pubkeys: string[]
): Promise<BroadcastRecipientProfile[]> {
  const normalized = [
    ...new Set(
      pubkeys.map((p) => p.toLowerCase().trim()).filter((p) => HEX64.test(p))
    ),
  ];
  const merged = new Map<string, BroadcastRecipientProfile>();

  for (let i = 0; i < normalized.length; i += PROFILE_CHUNK) {
    const chunk = normalized.slice(i, i + PROFILE_CHUNK);
    const wanted = new Set(chunk);
    try {
      const responses = await connectToPrimalCache("user_infos", {
        pubkeys: chunk,
      });
      if (Array.isArray(responses)) {
        const parsed = parseKind0FromResponses(responses, wanted);
        for (const [k, v] of parsed) merged.set(k, v);
      }
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        message: "broadcast recipient profiles batch failed",
        chunkSize: chunk.length,
      });
    }
  }

  return normalized.map((pk) => {
    const hit = merged.get(pk);
    if (hit) return hit;
    return {
      pubkey: pk,
      name: `${pk.slice(0, 8)}…`,
      picture: null,
      nip05: null,
    };
  });
}

export async function expandSavedAudienceEligiblePubkeys(
  userId: string,
  savedAudienceId: string
): Promise<{
  pubkeys: string[];
  fetchFailed: boolean;
  notFound?: boolean;
}> {
  const row = await prisma.broadcastSavedAudience.findFirst({
    where: { id: savedAudienceId, userId },
  });
  if (!row) {
    return { pubkeys: [], fetchFailed: false, notFound: true };
  }
  const user = await getUserById(userId);
  if (!user?.npub) {
    return { pubkeys: [], fetchFailed: true };
  }
  const hex =
    nostrAdapter.decodeNpub(user.npub)?.toLowerCase() ??
    user.npub.toLowerCase();
  if (!HEX64.test(hex)) {
    return { pubkeys: [], fetchFailed: true };
  }

  if (row.audienceType === "CUSTOM") {
    const r = await resolveAudiencePubkeys({
      audienceType: "CUSTOM",
      customLines: row.customNpubLines,
      senderPubkeyHex: hex,
    });
    return {
      pubkeys: r.pubkeys,
      fetchFailed: !!r.graphFetchFailed,
    };
  }
  if (row.audienceType === "MUTUALS") {
    const r = await resolveAudiencePubkeys({
      audienceType: "MUTUALS",
      customLines: [],
      senderPubkeyHex: hex,
    });
    return {
      pubkeys: r.pubkeys,
      fetchFailed: !!r.graphFetchFailed,
    };
  }
  return { pubkeys: [], fetchFailed: false };
}
