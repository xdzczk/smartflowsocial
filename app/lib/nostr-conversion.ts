import { nip19 } from "nostr-tools";
export function convertToHex(key: string): string | null {
  try {
    const { data } = nip19.decode(key);
    return typeof data === "string" ? data : null;
  } catch (_error) {
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
