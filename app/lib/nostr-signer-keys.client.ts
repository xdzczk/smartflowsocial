/**
 * Key/signer derivation helpers for Nostr signer management.
 * Used by nostr-signer-manager and nostr-signer-connection for hex ↔ bytes and serialization.
 */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Parse hex string to Uint8Array (e.g. for clientSecretKey from storage). */
export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex");
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function serializeSecretKey(key: Uint8Array): string {
  return bytesToHex(key);
}

/** Parse hex string to Uint8Array (e.g. for clientSecretKey from storage). */
export function parseSecretKeyHex(hex: string): Uint8Array {
  return hexToBytes(hex);
}
