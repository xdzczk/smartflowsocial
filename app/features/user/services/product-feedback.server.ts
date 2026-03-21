import type { SignedEvent } from "~/features/nostr/types";
import { env } from "~/lib/env.server";
import { convertToHex } from "~/lib/nostr-conversion";

/**
 * Lowercase hex pubkey for `FEEDBACK_INBOX_NPUB` (npub or 64-char hex), or null if unset/invalid.
 */
export function getFeedbackInboxPubkeyHex(): string | null {
  const raw = env.FEEDBACK_INBOX_NPUB?.trim();
  if (!raw) return null;
  if (raw.startsWith("npub")) {
    const h = convertToHex(raw);
    if (h && /^[0-9a-f]{64}$/i.test(h)) return h.toLowerCase();
    return null;
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) return raw.toLowerCase();
  return null;
}

/**
 * Server-side checks for a user-signed kind:4 DM to the feedback inbox.
 * Plaintext is not verified (encrypted); size and tags are.
 */
export function validateUserSignedFeedbackDm(params: {
  event: SignedEvent;
  inboxHexLower: string;
  sessionPubkey: string;
}): { ok: true } | { ok: false; error: string } {
  const { event, inboxHexLower, sessionPubkey } = params;

  if (event.kind !== 4) {
    return {
      ok: false,
      error: "Only encrypted direct messages (kind 4) are allowed.",
    };
  }

  if (event.pubkey.toLowerCase() !== sessionPubkey.toLowerCase()) {
    return { ok: false, error: "Event pubkey does not match your session." };
  }

  const recipientPTags = event.tags
    .filter((t) => Array.isArray(t) && t[0] === "p")
    .map((t) => (typeof t[1] === "string" ? t[1].toLowerCase() : ""));

  if (!recipientPTags.includes(inboxHexLower)) {
    return { ok: false, error: "Invalid DM recipient." };
  }

  if (typeof event.content !== "string" || event.content.length === 0) {
    return { ok: false, error: "Message content is empty." };
  }

  if (event.content.length > 100_000) {
    return { ok: false, error: "Message is too large." };
  }

  return { ok: true };
}

/**
 * Cached kind:10050 `relay` URLs for the configured feedback inbox (NIP-17), if any.
 */
export async function loadFeedbackInboxKind10050Relays(): Promise<string[]> {
  const hex = getFeedbackInboxPubkeyHex();
  if (!hex) return [];
  const { resolveCachedKind10050InboxRelays } =
    await import("~/lib/nostr.messenger.server");
  return resolveCachedKind10050InboxRelays(hex);
}

/**
 * Server-side checks for a user-published NIP-17 gift wrap (kind 1059) for feedback relaying.
 */
export function validateUserSignedFeedbackGiftWrap(params: {
  event: SignedEvent;
  inboxHexLower: string;
  sessionPubkey: string;
}): { ok: true } | { ok: false; error: string } {
  const { event, inboxHexLower, sessionPubkey } = params;

  if (event.kind !== 1059) {
    return { ok: false, error: "Invalid gift wrap kind." };
  }

  const pRaw = event.tags.find((t) => Array.isArray(t) && t[0] === "p");
  const p = typeof pRaw?.[1] === "string" ? pRaw[1].trim().toLowerCase() : "";
  if (!/^[0-9a-f]{64}$/.test(p)) {
    return { ok: false, error: "Gift wrap missing valid p tag." };
  }

  const inbox = inboxHexLower.toLowerCase();
  const session = sessionPubkey.toLowerCase();
  if (p !== inbox && p !== session) {
    return { ok: false, error: "Gift wrap recipient not allowed." };
  }

  if (typeof event.content !== "string" || event.content.length === 0) {
    return { ok: false, error: "Gift wrap content is empty." };
  }

  if (event.content.length > 200_000) {
    return { ok: false, error: "Gift wrap is too large." };
  }

  return { ok: true };
}
