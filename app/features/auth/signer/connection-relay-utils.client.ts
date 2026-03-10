/**
 * Relay list helpers for NIP-46 connection (build union, normalize, compare).
 */

import { RELAY_UNION_CAP } from "./connection-constants";

export function buildRelayUnion(
  stored: string[],
  defaults: string[],
  cap: number = RELAY_UNION_CAP
): string[] {
  const normalized = (r: string) => r.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of [...stored, ...defaults]) {
    const n = normalized(r);
    if (r.startsWith("wss://") && !seen.has(n)) {
      seen.add(n);
      out.push(r.trim());
      if (out.length >= cap) break;
    }
  }
  return out;
}

export function normalizeRelayList(relays: string[]): string[] {
  return Array.from(
    new Set(
      relays
        .map((relay) => relay.trim())
        .filter((relay) => relay.startsWith("wss://"))
    )
  );
}

export function relayListsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  return aSorted.every((relay, idx) => relay === bSorted[idx]);
}
