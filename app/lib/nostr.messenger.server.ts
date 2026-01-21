// Polyfill WebSocket for nostr-tools in Node.js (production only)
// Keep consistent with other server code using ws polyfills.
if (
  process.env.NODE_ENV !== "development" &&
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime polyfill check for Node.js environment
  globalThis.WebSocket === undefined
) {
  const { WebSocket } = require("ws") as {
    WebSocket: typeof globalThis.WebSocket;
  };
  globalThis.WebSocket = WebSocket;
}

import { nip04, finalizeEvent, nip19, SimplePool } from "nostr-tools";

import { logWarning, logError } from "~/lib/error-logger.server";

import { convertToHex } from "./nostr-conversion";
import { buildCacheKey, getOrSetJson } from "./redis-cache.server";
import { DEFAULT_USER_WRITE_RELAYS, relaysArray } from "./relays";

type RelayUrl = string;

interface NostrPoolLike {
  get?: (relays: string[], filter: unknown) => Promise<unknown>;
  list?: (relays: string[], filters: unknown[]) => Promise<unknown[]>;
  close?: () => void | Promise<void>;
}

function normalizeRelays(relays: RelayUrl[]): RelayUrl[] {
  return Array.from(new Set(relays.map((r) => r.trim()).filter(Boolean)));
}

function isValidWssRelayUrl(url: string): boolean {
  return /^wss:\/\/[a-zA-Z0-9][a-zA-Z0-9-._]+\.[a-zA-Z]{2,}(:[0-9]+)?(\/.*)?$/.test(
    url
  );
}

function capRelays(relays: string[], cap: number): string[] {
  if (cap <= 0) return [];
  return relays.slice(0, cap);
}

function parseNip65ReadRelaysFromEventTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const relays: string[] = [];
  for (const t of tags) {
    if (!Array.isArray(t)) continue;
    if (t[0] !== "r") continue;
    const url = typeof t[1] === "string" ? t[1].trim() : "";
    if (!url || !isValidWssRelayUrl(url)) continue;
    const marker = typeof t[2] === "string" ? t[2].toLowerCase() : "";
    // Prefer read relays; include unmarked relays; exclude explicit write-only.
    if (marker === "" || marker === "read") {
      relays.push(url);
    }
  }
  return relays;
}

async function fetchRecipientRelayListKind10002(receiverHex: string): Promise<{
  relays: string[];
}> {
  const bootstrapRelays = normalizeRelays(DEFAULT_USER_WRITE_RELAYS);
  const pool = new SimplePool();
  const timeoutMs = 2500;

  const filter = { kinds: [10002], authors: [receiverHex], limit: 1 };

  // nostr-tools SimplePool.get can hang if relays don't respond; guard with timeout.
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs)
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
      ? parseNip65ReadRelaysFromEventTags(eventObj.tags)
      : [];

    return { relays };
  } catch (error) {
    logWarning("Failed to fetch recipient relay list (NIP-65)", {
      receiverHex,
      error: error instanceof Error ? error.message : String(error),
    });
    return { relays: [] };
  } finally {
    try {
      // Best-effort close; SimplePool supports close(relays?) in newer versions.
      const poolLike = pool as unknown as NostrPoolLike;
      if (typeof poolLike.close === "function") {
        await Promise.resolve(poolLike.close());
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Resolve relay targets for delivering a system DM.
 *
 * Policy:
 * - Prefer recipient NIP-65 read relays (and unmarked relays) from kind:10002.
 * - Always include DEFAULT_USER_WRITE_RELAYS as a small fixed fallback set.
 * - Cap to keep metadata footprint bounded.
 */
async function resolveDmTargetRelays(receiverHex: string): Promise<string[]> {
  const cacheKey = buildCacheKey({
    namespace: "dm-relays",
    version: "v1",
    parts: { receiverHex },
  });

  const cached = await getOrSetJson<string[]>({
    cache: "dm-relays",
    key: cacheKey,
    ttlSeconds: 60 * 60 * 12, // 12h
    negativeTtlSeconds: 60 * 10, // 10m for empty results
    shouldNegativeCache: (v) => Array.isArray(v) && v.length === 0,
    compute: async () => {
      const { relays } = await fetchRecipientRelayListKind10002(receiverHex);
      // Cap recipient relays before merging to keep the set predictable.
      return capRelays(normalizeRelays(relays), 8);
    },
  });

  const baseFallback = DEFAULT_USER_WRITE_RELAYS;
  const merged =
    cached.length > 0
      ? normalizeRelays([...cached, ...baseFallback])
      : normalizeRelays(baseFallback);
  return capRelays(merged, 12);
}

interface SystemSecretKey {
  secretKeyHex: string;
  privateKeyBytes: Uint8Array;
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(
    hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []
  );
}

function parseSystemSecretKey(nsecEnv: string): SystemSecretKey | null {
  const raw = nsecEnv.trim();

  // Prefer nsec bech32 (decodes to bytes)
  if (raw.startsWith("nsec")) {
    try {
      const decoded = nip19.decode(raw);
      if (decoded.type === "nsec") {
        const privateKeyBytes = decoded.data;
        const secretKeyHex = Buffer.from(privateKeyBytes).toString("hex");
        return { secretKeyHex, privateKeyBytes };
      }
    } catch {
      // fallthrough
    }
  }

  // Accept raw 64-char hex
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    const secretKeyHex = raw.toLowerCase();
    return { secretKeyHex, privateKeyBytes: hexToBytes(secretKeyHex) };
  }

  // Best-effort decode other bech32 inputs that yield hex strings
  const converted = convertToHex(raw);
  if (converted && /^[0-9a-f]{64}$/i.test(converted)) {
    const secretKeyHex = converted.toLowerCase();
    return { secretKeyHex, privateKeyBytes: hexToBytes(secretKeyHex) };
  }

  return null;
}

function resolveReceiverHex(receiverPubkey: string): string {
  // Ensure receiver pubkey is hex. Convert if an npub/bech32 is provided.
  try {
    if (
      typeof receiverPubkey === "string" &&
      receiverPubkey.startsWith("npub")
    ) {
      const converted = convertToHex(receiverPubkey);
      if (converted) return converted;
    }
  } catch (e) {
    logWarning(
      "Failed to convert receiver pubkey to hex; using original value",
      {
        receiverPubkey,
        error: e instanceof Error ? e.message : String(e),
      }
    );
  }
  return receiverPubkey;
}

async function resolveDmRelaysSafe(receiverHex: string): Promise<string[]> {
  // Basic hex sanity check (64 hex chars)
  if (!/^[0-9a-f]{64}$/i.test(receiverHex)) return DEFAULT_USER_WRITE_RELAYS;
  try {
    return await resolveDmTargetRelays(receiverHex);
  } catch (e) {
    logWarning("Failed to resolve DM target relays; using fallback", {
      receiverHex,
      error: e instanceof Error ? e.message : String(e),
    });
    return DEFAULT_USER_WRITE_RELAYS;
  }
}

async function readResponseTextSafe(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

interface SendNostrDirectMessageResult {
  success: boolean;
  event?: unknown;
  status?: number;
  error?: string;
}

export async function sendNostrDirectMessage(
  receiverPubkey: string,
  content: string
): Promise<SendNostrDirectMessageResult | false> {
  try {
    if (!content) {
      return false;
    }
    const nsecEnv = process.env["NOSTR_NSEC"];
    if (!nsecEnv) {
      return Promise.resolve({
        success: false,
        error: "NOSTR_NSEC is not set.",
      });
    }
    const systemKey = parseSystemSecretKey(nsecEnv);
    if (!systemKey || systemKey.privateKeyBytes.length === 0) {
      return {
        success: false,
        error: "NOSTR_NSEC could not be converted to a usable secret key.",
      };
    }

    const receiverHex = resolveReceiverHex(receiverPubkey);

    const relaysToUse = await resolveDmRelaysSafe(receiverHex);

    // Encrypt the content
    const encryptedContent: string = nip04.encrypt(
      systemKey.secretKeyHex,
      receiverHex,
      content
    );

    // Create event template
    const eventTemplate = {
      kind: 4, // NIP-04 encrypted direct message
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["p", receiverHex], // Recipient's pubkey
      ],
      content: encryptedContent,
    };

    // Sign the event
    const signedEvent = finalizeEvent(eventTemplate, systemKey.privateKeyBytes);

    // Send the event to the publisher
    const publisherUrl = process.env["NOSTR_PUBLISHER_URL"];
    if (!publisherUrl) {
      return {
        success: false,
        error: "NOSTR_PUBLISHER_URL is not set.",
        event: signedEvent,
      };
    }

    const response = await fetch(publisherUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        relays: relaysToUse.length > 0 ? relaysToUse : relaysArray,
        event: signedEvent,
      }),
    });

    if (!response.ok) {
      const errorText = await readResponseTextSafe(response);
      return {
        success: false,
        status: response.status,
        error: errorText,
        event: signedEvent,
      };
    }

    return { success: true, event: signedEvent };
  } catch (error: unknown) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      receiverPubkey,
      message: "Error sending Nostr direct message",
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
