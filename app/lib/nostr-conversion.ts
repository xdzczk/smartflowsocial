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
