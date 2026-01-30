/**
 * Pure relay-list parsing. No .client suffix so this runs in both server and client
 * bundles (required for NostrLoginPanel SSR when redirecting back from Primal).
 */
export function parseRelayList(raw: string): string[] {
  return raw
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
