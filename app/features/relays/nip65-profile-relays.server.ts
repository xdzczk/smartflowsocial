/**
 * Fetch NIP-65 (kind 10002) relay list metadata for an author — write relays for publishing.
 */

import { DEFAULT_USER_WRITE_RELAYS } from "~/features/relays/relay-constants";
import { env } from "~/lib/env.server";

if (
  env.NODE_ENV !== "development" &&
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Node may lack WebSocket until polyfill
  globalThis.WebSocket === undefined
) {
  const { WebSocket } = require("ws") as {
    WebSocket: typeof globalThis.WebSocket;
  };
  globalThis.WebSocket = WebSocket;
}

// eslint-disable-next-line import/order -- polyfill must run before nostr-tools loads
import { SimplePool } from "nostr-tools";

import { logWarning } from "~/lib/error-logger.server";

interface NostrPoolLike {
  get?: (relays: string[], filter: unknown) => Promise<unknown>;
  list?: (relays: string[], filters: unknown[]) => Promise<unknown[]>;
  close?: () => void | Promise<void>;
}

function normalizeRelays(relays: string[]): string[] {
  return Array.from(new Set(relays.map((r) => r.trim()).filter(Boolean)));
}

function isValidWssRelayUrl(url: string): boolean {
  return /^wss:\/\/[a-zA-Z0-9][a-zA-Z0-9-._]+\.[a-zA-Z]{2,}(:[0-9]+)?(\/.*)?$/.test(
    url
  );
}

/** NIP-65 `r` tags: unmarked or explicit "write" markers count as publish targets. */
export function parseNip65WriteRelaysFromEventTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const relays: string[] = [];
  for (const t of tags) {
    if (!Array.isArray(t)) continue;
    if (t[0] !== "r") continue;
    const url = typeof t[1] === "string" ? t[1].trim() : "";
    if (!url || !isValidWssRelayUrl(url)) continue;
    const marker = typeof t[2] === "string" ? t[2].toLowerCase() : "";
    if (marker === "" || marker === "write") {
      relays.push(url);
    }
  }
  return relays;
}

const KIND10002_TIMEOUT_MS = 2500;

/**
 * Best-effort fetch of the author's latest kind 10002 and extract write relay URLs.
 */
export async function fetchAuthorNip65WriteRelays(
  authorPubkeyHex: string
): Promise<string[]> {
  const bootstrapRelays = normalizeRelays(DEFAULT_USER_WRITE_RELAYS);
  const pool = new SimplePool();

  const filter = { kinds: [10002], authors: [authorPubkeyHex], limit: 1 };

  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), KIND10002_TIMEOUT_MS)
  );

  try {
    const poolLike = pool as unknown as NostrPoolLike;
    const evt = await Promise.race([
      (async () => {
        if (typeof poolLike.get === "function") {
          return await poolLike.get(bootstrapRelays, filter);
        }
        if (typeof poolLike.list === "function") {
          const events = await poolLike.list(bootstrapRelays, [filter]);
          return Array.isArray(events) ? (events[0] ?? null) : null;
        }
        return null;
      })(),
      timeout,
    ]);

    const eventObj =
      evt && typeof evt === "object" && !Array.isArray(evt)
        ? (evt as { tags?: unknown })
        : null;

    const relays = eventObj?.tags
      ? parseNip65WriteRelaysFromEventTags(eventObj.tags)
      : [];

    return normalizeRelays(relays);
  } catch (error) {
    logWarning("Failed to fetch author NIP-65 relay list (kind 10002)", {
      authorPubkeyHex,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  } finally {
    try {
      const poolLike = pool as unknown as NostrPoolLike;
      if (typeof poolLike.close === "function") {
        await Promise.resolve(poolLike.close());
      }
    } catch {
      // ignore
    }
  }
}
