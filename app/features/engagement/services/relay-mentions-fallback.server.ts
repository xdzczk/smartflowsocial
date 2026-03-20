/**
 * When Primal `get_notifications` is unavailable (e.g. self-hosted cache without that API),
 * fetch kind-1 notes that tag the user via relay `#p` filters.
 */

import { env } from "~/lib/env.server";

// Polyfill WebSocket for nostr-tools in Node (same pattern as nostr.messenger.server.ts)
if (
  env.NODE_ENV !== "development" &&
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime polyfill check for Node.js environment
  globalThis.WebSocket === undefined
) {
  const { WebSocket } = require("ws") as {
    WebSocket: typeof globalThis.WebSocket;
  };
  globalThis.WebSocket = WebSocket;
}

// eslint-disable-next-line import/order -- polyfill must run before nostr-tools loads
import { SimplePool, type Event } from "nostr-tools";

import { logError } from "~/lib/error-logger.server";

const DEFAULT_RELAYS: string[] = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.snort.social",
];

const MAX_RELAYS_PER_QUERY = 20;

function isRelayUrl(s: string): boolean {
  return s.startsWith("wss://") || s.startsWith("ws://");
}

/**
 * Normalize relays from user settings (Settings → Relays). Dedupe, cap count.
 */
export function normalizeUserRelayUrlsForQuery(
  userRelays: string[] | undefined | null
): string[] | null {
  if (!userRelays || !Array.isArray(userRelays)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of userRelays) {
    const s = typeof u === "string" ? u.trim() : "";
    if (!s || !isRelayUrl(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_RELAYS_PER_QUERY) break;
  }
  return out.length > 0 ? out : null;
}

function parseRelayListFromEnv(): string[] {
  const raw = process.env["MENTIONS_RELAY_FALLBACK_RELAYS"];
  if (!raw || typeof raw !== "string") return DEFAULT_RELAYS;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => isRelayUrl(s));
  return parts.length > 0
    ? parts.slice(0, MAX_RELAYS_PER_QUERY)
    : DEFAULT_RELAYS;
}

function resolveRelayUrlsForMentionFallback(
  userRelays: string[] | undefined | null
): string[] {
  const fromSettings = normalizeUserRelayUrlsForQuery(userRelays);
  if (fromSettings && fromSettings.length > 0) {
    return fromSettings;
  }
  return parseRelayListFromEnv();
}

/**
 * Query relays for kind-1 events whose `p` tags include `pubkeyHex`.
 * Uses `userRelays` from account settings when provided and non-empty; otherwise
 * `MENTIONS_RELAY_FALLBACK_RELAYS` or built-in defaults.
 * Best-effort; returns [] on timeout or error.
 */
export async function fetchKind1EventsMentioningPubkeyViaRelays(
  pubkeyHex: string,
  options?: {
    limit?: number;
    since?: number;
    maxWaitMs?: number;
    /** User's Settings → Relays (preferred when non-empty). */
    userRelays?: string[] | null;
  }
): Promise<Event[]> {
  const relays = resolveRelayUrlsForMentionFallback(
    options?.userRelays ?? null
  );
  const limit = options?.limit ?? 80;
  const since =
    options?.since ?? Math.floor(Date.now() / 1000) - 90 * 24 * 3600;
  const maxWaitMs = options?.maxWaitMs ?? 12_000;

  const pool = new SimplePool();

  try {
    const events = await pool.querySync(
      relays,
      {
        kinds: [1],
        "#p": [pubkeyHex],
        limit,
        since,
      },
      {
        maxWait: maxWaitMs,
      }
    );
    return events.sort((a, b) => b.created_at - a.created_at);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message: "Relay #p mention fallback failed",
      pubkeyHexPrefix: pubkeyHex.slice(0, 8),
    });
    return [];
  } finally {
    try {
      pool.close(relays);
    } catch {
      /* ignore */
    }
  }
}
