/**
 * Batch `user_infos` fetch for search / thread reply display names.
 */

import { connectToPrimalCache } from "~/features/cache/primalCache.server";
import { logError } from "~/lib/error-logger.server";

interface Kind0ProfileEvent {
  kind?: number;
  pubkey?: string;
  content?: string;
}

export async function fetchAuthorsInfoBatch(
  pubkeys: string[]
): Promise<Map<string, { name: string; image: string | null }>> {
  const map = new Map<string, { name: string; image: string | null }>();
  const unique = [...new Set(pubkeys.filter(Boolean))];
  const uniqueSet = new Set(unique);
  for (const p of unique) {
    map.set(p, { name: `${p.slice(0, 8)}...`, image: null });
  }
  if (unique.length === 0) return map;

  try {
    const userInfoResponses = await connectToPrimalCache("user_infos", {
      pubkeys: unique,
    });

    for (const res of userInfoResponses) {
      if (!Array.isArray(res) || res[0] !== "EVENT" || res[2] == null) {
        continue;
      }
      const event = res[2] as Kind0ProfileEvent;
      if (event.kind !== 0 || typeof event.pubkey !== "string") continue;
      const pk = event.pubkey;
      if (!uniqueSet.has(pk)) continue;

      try {
        const metadata = JSON.parse(
          typeof event.content === "string" ? event.content : "{}"
        ) as {
          name?: string;
          display_name?: string;
          picture?: string;
        };
        let authorName =
          metadata.name ??
          metadata.display_name ??
          map.get(pk)?.name ??
          `${pk.slice(0, 8)}...`;
        if (!authorName.trim() || authorName === "...") {
          authorName = `${pk.slice(0, 8)}...`;
        }
        map.set(pk, {
          name: authorName,
          image: metadata.picture ?? null,
        });
      } catch {
        // keep default
      }
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "[Search] Error batch-fetching author info",
      count: unique.length,
    });
  }

  return map;
}
