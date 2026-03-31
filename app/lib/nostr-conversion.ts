import { nip19 } from "nostr-tools";

/** 64-char hex secp256k1 pubkey (how `User.npub` is stored after Nostr auth v2). */
const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/i;

/**
 * Normalize a Nostr public key to lowercase hex.
 * Accepts bech32 `npub1…` (NIP-19) or raw 64-char hex (stored DB format).
 */
export function convertToHex(key: string | null | undefined): string | null {
  if (key == null || typeof key !== "string") {
    return null;
  }
  const trimmed = key.trim();
  if (!trimmed) return null;
  if (HEX_PUBKEY_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  try {
    const { data } = nip19.decode(trimmed);
    return typeof data === "string" ? data : null;
  } catch {
    return null;
  }
}

export function convertHexToNpub(hexKey: string): string {
  try {
    return nip19.npubEncode(hexKey);
  } catch (_error) {
    return hexKey; // Return original hex if conversion fails
  }
}

/**
 * Format a hex key or npub to a shortened display format
 * Works in both server and client contexts
 * @param hexOrNpub - A hex public key or npub string
 * @returns A shortened string like "npub1abc...xyz123" or empty string if input is invalid
 */
export function formatNpubShort(hexOrNpub?: string): string {
  if (!hexOrNpub) return "";

  // If it's already an npub, just shorten it
  if (hexOrNpub.startsWith("npub")) {
    if (hexOrNpub.length <= 20) return hexOrNpub;
    return `${hexOrNpub.slice(0, 8)}...${hexOrNpub.slice(-8)}`;
  }

  // Try to convert hex to npub
  try {
    const npub = nip19.npubEncode(hexOrNpub);
    if (npub.length <= 20) return npub;
    return `${npub.slice(0, 8)}...${npub.slice(-8)}`;
  } catch {
    // If conversion fails, just shorten the hex
    if (hexOrNpub.length <= 20) return hexOrNpub;
    return `${hexOrNpub.slice(0, 8)}...${hexOrNpub.slice(-8)}`;
  }
}
