/**
 * Referral param validation: ref must parse as valid npub.
 * Returns canonical npub or null if invalid.
 */

import { nostrAdapter } from "~/lib/nostr-adapter.server";

export function validateAndNormalizeRefNpub(ref: string | null): string | null {
  if (!ref || typeof ref !== "string") return null;
  const trimmed = ref.trim();
  if (!trimmed) return null;
  const hex = nostrAdapter.decodeNpub(trimmed);
  if (hex?.length !== 64) return null;
  const npub = nostrAdapter.encodeNpub(hex);
  return npub ?? null;
}
