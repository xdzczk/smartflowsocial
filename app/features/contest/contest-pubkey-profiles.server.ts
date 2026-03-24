/**
 * Batch-fetch Nostr profile metadata for leaderboard display (display name, picture, npub).
 */

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";

interface NostrEventWithMetadata {
  kind?: number;
  pubkey?: string;
  content?: string;
}

export interface ContestPubkeyProfile {
  pubkey: string;
  npub: string;
  displayName: string;
  picture: string | null;
}

function uniqStrings(ids: string[]): string[] {
  return [...new Set(ids.filter((x) => typeof x === "string" && x.length > 0))];
}

/**
 * Fetches kind-0 metadata for up to `max` pubkeys (deduped).
 */
export async function fetchContestPubkeyProfiles(
  pubkeys: string[],
  max = 80
): Promise<Record<string, ContestPubkeyProfile>> {
  const out: Record<string, ContestPubkeyProfile> = {};
  const hexList = uniqStrings(pubkeys).slice(0, max);
  if (hexList.length === 0) return out;

  for (const pubkey of hexList) {
    const npub = nostrAdapter.encodeNpub(pubkey) ?? "";
    out[pubkey] = {
      pubkey,
      npub: npub || "",
      displayName: `${pubkey.slice(0, 8)}…`,
      picture: null,
    };
  }

  try {
    const responses = await connectToPrimalCache("user_infos", {
      pubkeys: hexList,
    });
    if (!Array.isArray(responses)) return out;

    const byPubkey = new Map<
      string,
      { name: string; picture: string | null }
    >();
    for (const res of responses) {
      if (!Array.isArray(res) || res[0] !== "EVENT" || res[2] === undefined) {
        continue;
      }
      const ev = res[2] as NostrEventWithMetadata;
      if (ev.kind !== 0 || !ev.pubkey) continue;
      try {
        const meta = JSON.parse(String(ev.content ?? "{}")) as {
          name?: string;
          display_name?: string;
          picture?: string;
        };
        const name =
          (typeof meta.display_name === "string" && meta.display_name.trim()
            ? meta.display_name.trim()
            : null) ??
          (typeof meta.name === "string" && meta.name.trim()
            ? meta.name.trim()
            : null);
        const picture =
          typeof meta.picture === "string" &&
          meta.picture.trim().startsWith("http")
            ? meta.picture.trim()
            : null;
        byPubkey.set(ev.pubkey, {
          name: name ?? `${ev.pubkey.slice(0, 8)}…`,
          picture,
        });
      } catch {
        // skip bad JSON
      }
    }

    for (const pubkey of hexList) {
      const row = byPubkey.get(pubkey);
      const npub = nostrAdapter.encodeNpub(pubkey) ?? "";
      if (row) {
        out[pubkey] = {
          pubkey,
          npub,
          displayName: row.name,
          picture: row.picture,
        };
      }
    }
  } catch {
    // keep fallbacks
  }

  return out;
}
