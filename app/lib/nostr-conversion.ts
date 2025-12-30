import { nip19 } from "nostr-tools";
export function convertToHex(key: string): string | null {
  try {
    const { data } = nip19.decode(key);
    return typeof data === "string" ? data : null;
  } catch (error) {
    console.error("Error decoding npub:", error);
    return null;
  }
}

export function convertHexToNpub(hexKey: string): string {
  try {
    return nip19.npubEncode(hexKey);
  } catch (error) {
    console.error("Error encoding hex to npub:", error);
    return hexKey; // Return original hex if conversion fails
  }
}
