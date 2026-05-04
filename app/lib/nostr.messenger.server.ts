/* eslint-disable import/order -- env must load before nostr-tools WebSocket polyfill */
import { env } from "~/lib/env.server";

// Polyfill WebSocket for nostr-tools in Node.js (production only); must run before nostr-tools import
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

import { nip04, finalizeEvent, nip19, SimplePool } from "nostr-tools";
import { wrapManyEvents } from "nostr-tools/nip17";
import { getPublicKey } from "nostr-tools/pure";

import { logWarning, logError } from "~/lib/error-logger.server";
import { featureFlags } from "~/lib/feature-flags.server";
import {
  DEFAULT_USER_WRITE_RELAYS,
  relaysArray,
} from "~/features/relays/relay-constants";

import { convertToHex } from "./nostr-conversion";
import { buildCacheKey, getOrSetJson } from "~/lib/redis-cache.server";

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

/** NIP-17 kind:10050 inbox list  -  `relay` tags only (no merge with defaults). */
function parseKind10050RelayTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const relays: string[] = [];
  for (const t of tags) {
    if (!Array.isArray(t)) continue;
    if (t[0] !== "relay") continue;
    const url = typeof t[1] === "string" ? t[1].trim() : "";
    if (!url || !isValidWssRelayUrl(url)) continue;
    relays.push(url);
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

async function fetchRecipientInboxRelaysKind10050(
  receiverHex: string
): Promise<{
  relays: string[];
}> {
  const bootstrapRelays = normalizeRelays(DEFAULT_USER_WRITE_RELAYS);
  const pool = new SimplePool();
  const timeoutMs = 2500;

  const filter = { kinds: [10050], authors: [receiverHex], limit: 1 };

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

    const relays = eventObj?.tags ? parseKind10050RelayTags(eventObj.tags) : [];

    return { relays };
  } catch (error) {
    logWarning("Failed to fetch recipient inbox relays (kind 10050, NIP-17)", {
      receiverHex,
      error: error instanceof Error ? error.message : String(error),
    });
    return { relays: [] };
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

/**
 * Cached kind:10050 `relay` URLs for a pubkey (NIP-17 inbox). Does not merge defaults.
 */
export async function resolveCachedKind10050InboxRelays(
  pubkeyHex: string
): Promise<string[]> {
  if (!/^[0-9a-f]{64}$/i.test(pubkeyHex)) return [];
  const lower = pubkeyHex.toLowerCase();
  const cacheKey = buildCacheKey({
    namespace: "dm-inbox-10050",
    version: "v1",
    parts: { pubkeyHex: lower },
  });

  return getOrSetJson<string[]>({
    cache: "dm-inbox-10050",
    key: cacheKey,
    ttlSeconds: 60 * 60 * 12,
    negativeTtlSeconds: 60 * 10,
    shouldNegativeCache: (v) => Array.isArray(v) && v.length === 0,
    compute: async () => {
      const { relays } = await fetchRecipientInboxRelaysKind10050(lower);
      return capRelays(normalizeRelays(relays), 8);
    },
  });
}

function mergeNip17PublishRelays(inboxRelays: string[]): string[] {
  if (inboxRelays.length === 0) return [];
  const merged = normalizeRelays([
    ...inboxRelays,
    ...DEFAULT_USER_WRITE_RELAYS,
  ]);
  return capRelays(merged, 12);
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

export async function resolveDmRelaysSafe(
  receiverHex: string
): Promise<string[]> {
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

export function giftWrapRecipientPubkeyHex(event: {
  tags?: unknown;
}): string | null {
  const tags = event.tags;
  if (!Array.isArray(tags)) return null;
  for (const t of tags) {
    if (!Array.isArray(t) || t[0] !== "p") continue;
    const pk = typeof t[1] === "string" ? t[1].trim().toLowerCase() : "";
    if (/^[0-9a-f]{64}$/.test(pk)) return pk;
  }
  return null;
}

export async function relaysForNip17GiftWrap(params: {
  giftWrapPTag: string;
  receiverHexLower: string;
  recipientInboxRelays: string[];
  senderHexLower: string;
}): Promise<string[]> {
  const p = params.giftWrapPTag.toLowerCase();
  if (p === params.receiverHexLower) {
    return mergeNip17PublishRelays(params.recipientInboxRelays);
  }
  if (p === params.senderHexLower) {
    const senderInbox = await resolveCachedKind10050InboxRelays(
      params.senderHexLower
    );
    return senderInbox.length > 0
      ? mergeNip17PublishRelays(senderInbox)
      : normalizeRelays(DEFAULT_USER_WRITE_RELAYS);
  }
  return normalizeRelays(DEFAULT_USER_WRITE_RELAYS);
}

export interface SendNostrDirectMessageResult {
  success: boolean;
  event?: unknown;
  status?: number;
  error?: string;
  nip17?: {
    attempted: boolean;
    recipientPublished: boolean;
    errors?: string[];
  };
  nip04?: { success: boolean };
}

async function publishEventToRelays(
  event: Record<string, unknown>,
  relaysToUse: string[]
): Promise<SendNostrDirectMessageResult> {
  const publisherUrl = env.NOSTR_PUBLISHER_URL;
  if (!publisherUrl) {
    return {
      success: false,
      error: "NOSTR_PUBLISHER_URL is not set.",
      event,
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const apiToken = env.NOSTR_PUBLISHER_API_TOKEN;
  if (apiToken) {
    headers["API-TOKEN"] = apiToken;
  }

  const relayList =
    relaysToUse.length > 0 ? relaysToUse : normalizeRelays(relaysArray);

  const response = await fetch(publisherUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      relays: relayList,
      event,
    }),
  });

  if (!response.ok) {
    const errorText = await readResponseTextSafe(response);

    if (response.status === 409) {
      return {
        success: false,
        status: response.status,
        error: `Event already published (replay protection): ${errorText}`,
        event,
      };
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const retryMsg = retryAfter ? ` Retry after ${retryAfter} seconds.` : "";
      return {
        success: false,
        status: response.status,
        error: `Rate limit exceeded.${retryMsg} ${errorText}`,
        event,
      };
    }

    return {
      success: false,
      status: response.status,
      error: errorText,
      event,
    };
  }

  return { success: true, event };
}

type Nip17Outcome = NonNullable<SendNostrDirectMessageResult["nip17"]>;

async function tryPublishNip17DirectMessages(params: {
  receiverPubkey: string;
  receiverHex: string;
  systemKey: SystemSecretKey;
  content: string;
}): Promise<Nip17Outcome> {
  const meta: Nip17Outcome = {
    attempted: false,
    recipientPublished: false,
    errors: [],
  };

  const { receiverPubkey, receiverHex, systemKey, content } = params;

  if (
    !featureFlags.nostrDmNip17Enabled ||
    !/^[0-9a-f]{64}$/i.test(receiverHex)
  ) {
    return meta;
  }

  const recipientInboxRelays =
    await resolveCachedKind10050InboxRelays(receiverHex);
  if (recipientInboxRelays.length === 0) {
    return meta;
  }

  meta.attempted = true;
  const senderHexLower = getPublicKey(systemKey.privateKeyBytes).toLowerCase();

  try {
    const preferredRelay = recipientInboxRelays[0];
    const giftWraps = wrapManyEvents(
      systemKey.privateKeyBytes,
      [{ publicKey: receiverHex, relayUrl: preferredRelay }],
      content
    );

    for (const gw of giftWraps) {
      const pTag = giftWrapRecipientPubkeyHex(gw);
      if (!pTag) {
        meta.errors?.push("Gift wrap missing p tag");
        continue;
      }
      const relaysForWrap = await relaysForNip17GiftWrap({
        giftWrapPTag: pTag,
        receiverHexLower: receiverHex,
        recipientInboxRelays,
        senderHexLower,
      });
      const pubResult = await publishEventToRelays(
        gw as unknown as Record<string, unknown>,
        relaysForWrap
      );
      if (!pubResult.success) {
        meta.errors?.push(
          pubResult.error ?? `NIP-17 publish failed (kind ${String(gw.kind)})`
        );
        logWarning("NIP-17 gift wrap publish failed", {
          receiverPubkey,
          kind: gw.kind,
          error: pubResult.error,
        });
      } else if (pTag === receiverHex) {
        meta.recipientPublished = true;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    meta.errors?.push(msg);
    logError(e instanceof Error ? e : new Error(msg), {
      receiverPubkey,
      message: "NIP-17 wrap or publish error",
    });
  }

  return meta;
}

export async function sendNostrDirectMessage(
  receiverPubkey: string,
  content: string
): Promise<SendNostrDirectMessageResult | false> {
  try {
    if (!content) {
      return false;
    }
    const nsecEnv = env.NOSTR_NSEC;
    if (!nsecEnv) {
      return Promise.resolve({
        success: false,
        error: "NOSTR_NSEC is not set.",
        nip17: { attempted: false, recipientPublished: false },
        nip04: { success: false },
      });
    }
    const systemKey = parseSystemSecretKey(nsecEnv);
    if (!systemKey || systemKey.privateKeyBytes.length === 0) {
      return {
        success: false,
        error: "NOSTR_NSEC could not be converted to a usable secret key.",
        nip17: { attempted: false, recipientPublished: false },
        nip04: { success: false },
      };
    }

    const receiverHexRaw = resolveReceiverHex(receiverPubkey);
    const receiverHex = /^[0-9a-f]{64}$/i.test(receiverHexRaw)
      ? receiverHexRaw.toLowerCase()
      : receiverHexRaw;

    const nip17Meta = await tryPublishNip17DirectMessages({
      receiverPubkey,
      receiverHex,
      systemKey,
      content,
    });

    const relaysToUse = await resolveDmRelaysSafe(receiverHex);

    const encryptedContent: string = nip04.encrypt(
      systemKey.secretKeyHex,
      receiverHex,
      content
    );

    const eventTemplate = {
      kind: 4, // NIP-04 encrypted direct message
      created_at: Math.floor(Date.now() / 1000),
      tags: [["p", receiverHex]],
      content: encryptedContent,
    };

    const signedEvent = finalizeEvent(eventTemplate, systemKey.privateKeyBytes);

    const nip04Result = await publishEventToRelays(
      signedEvent as unknown as Record<string, unknown>,
      relaysToUse
    );

    const merged: SendNostrDirectMessageResult = {
      ...nip04Result,
      success: nip04Result.success,
      event: signedEvent,
      nip17: nip17Meta,
      nip04: { success: nip04Result.success },
    };

    if (!nip04Result.success) {
      merged.error = nip04Result.error;
      merged.status = nip04Result.status;
    }

    return merged;
  } catch (error: unknown) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      receiverPubkey,
      message: "Error sending Nostr direct message",
    });
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
      nip17: { attempted: false, recipientPublished: false },
      nip04: { success: false },
    };
  }
}

/* eslint-enable import/order */
