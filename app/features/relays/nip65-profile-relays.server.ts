/**
 * Fetch NIP-65 (kind 10002) relay list metadata for an author.
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

import type {
  Nip65ProfileRelayEntry,
  Nip65RelayScope,
} from "./nip65-relay-entry";

export type {
  Nip65ProfileRelayEntry,
  Nip65RelayScope,
} from "./nip65-relay-entry";

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

/**
 * Parse all valid `r` tags from kind 10002 tags (order preserved).
 */
export function parseNip65ProfileRelayEntriesFromEventTags(
  tags: unknown
): Nip65ProfileRelayEntry[] {
  if (!Array.isArray(tags)) return [];
  const out: Nip65ProfileRelayEntry[] = [];
  for (const t of tags) {
    if (!Array.isArray(t) || t[0] !== "r") continue;
    const url = typeof t[1] === "string" ? t[1].trim() : "";
    if (!url || !isValidWssRelayUrl(url)) continue;
    const markerRaw = typeof t[2] === "string" ? t[2].trim().toLowerCase() : "";
    const scope: Nip65RelayScope =
      markerRaw === "read" ? "read" : markerRaw === "write" ? "write" : "both";
    out.push({ url, scope });
  }
  return out;
}

/** URLs where the author may publish (unmarked or `write`). */
export function nip65ProfileEntriesToWriteUrls(
  entries: Nip65ProfileRelayEntry[]
): string[] {
  return normalizeRelays(
    entries
      .filter((e) => e.scope === "both" || e.scope === "write")
      .map((e) => e.url)
  );
}

/** NIP-65 `r` tags: unmarked or explicit "write" markers count as publish targets. */
export function parseNip65WriteRelaysFromEventTags(tags: unknown): string[] {
  return nip65ProfileEntriesToWriteUrls(
    parseNip65ProfileRelayEntriesFromEventTags(tags)
  );
}

const KIND10002_TIMEOUT_MS = 2500;

async function fetchAuthorKind10002Tags(
  authorPubkeyHex: string
): Promise<unknown[] | null> {
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

    const raw = eventObj?.tags;
    return Array.isArray(raw) ? raw : null;
  } catch (error) {
    logWarning("Failed to fetch author NIP-65 relay list (kind 10002)", {
      authorPubkeyHex,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
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

export async function fetchAuthorNip65Kind10002RelayData(
  authorPubkeyHex: string
): Promise<{
  entries: Nip65ProfileRelayEntry[];
  writeRelayUrls: string[];
}> {
  const tags = await fetchAuthorKind10002Tags(authorPubkeyHex);
  if (!tags) {
    return { entries: [], writeRelayUrls: [] };
  }
  const entries = parseNip65ProfileRelayEntriesFromEventTags(tags);
  const writeRelayUrls = nip65ProfileEntriesToWriteUrls(entries);
  return { entries, writeRelayUrls };
}

/**
 * Best-effort fetch of the author's latest kind 10002 and extract write relay URLs.
 */
export async function fetchAuthorNip65WriteRelays(
  authorPubkeyHex: string
): Promise<string[]> {
  const { writeRelayUrls } =
    await fetchAuthorNip65Kind10002RelayData(authorPubkeyHex);
  return writeRelayUrls;
}
