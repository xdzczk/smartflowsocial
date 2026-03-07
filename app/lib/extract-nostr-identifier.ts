/**
 * Extract a Nostr identifier from pasted text (raw identifier or URL from Primal, Coracle, etc.).
 * Safe to use on client and server.
 *
 * Examples:
 * - "https://primal.net/a/naddr1qvzqqqr4gupz..." -> "naddr1qvzqqqr4gupz..."
 * - "https://coracle.social/notes/nevent1qy2hwumn8ghj7..." -> "nevent1qy2hwumn8ghj7..."
 * - "nevent1qy2..." -> "nevent1qy2..."
 */

const BECH32_PREFIXES = ["note1", "nevent1", "naddr1"] as const;
/** Bech32 data part uses 32-char alphabet (excludes 1,i,o,b to avoid confusion) */
// eslint-disable-next-line no-secrets/no-secrets -- Bech32 alphabet constant, not a secret
const BECH32_DATA = "[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+";

function matchBech32Identifier(s: string): string | null {
  const re = new RegExp(
    `(?:nostr:)?(${BECH32_PREFIXES.join("|")})${BECH32_DATA}`,
    "i"
  );
  const m = s.trim().match(re);
  if (!m) return null;
  const raw = m[0];
  return raw.startsWith("nostr:") ? raw.slice(6) : raw;
}

/**
 * If the input is already a direct Nostr identifier (note1, nevent1, naddr1, nostr:..., or 64-char hex), return it trimmed.
 * Otherwise if it looks like a URL or contains a bech32 identifier, extract and return that identifier.
 * Returns null if no identifier found.
 */
export function extractNostrIdentifier(input: string): string | null {
  const t = input.trim();
  if (!t) return null;

  if (t.startsWith("nostr:")) {
    const rest = t.slice(6).trim();
    if (
      rest.startsWith("note1") ||
      rest.startsWith("nevent1") ||
      rest.startsWith("naddr1")
    ) {
      return rest;
    }
  }
  if (BECH32_PREFIXES.some((p) => t.startsWith(p))) {
    return t;
  }
  if (/^[0-9a-f]{64}$/i.test(t)) {
    return t;
  }

  const fromUrl = matchBech32Identifier(t);
  if (fromUrl) return fromUrl;

  return null;
}
