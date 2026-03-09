/**
 * Constants and pure helpers for the remote signer reconnect dialog.
 * Used by RemoteSignerReconnectController and useReconnectDialogState.
 */

export const DEFAULT_RELAYS = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
].join("\n");

export const DEFAULT_RELAYS_ARRAY = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
];

export const RELAY_UNION_CAP = 8;

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

export const PROFILE_MISMATCH_MESSAGE =
  "Different signer profile detected. Please activate the same identity as your SmartFlow connection.";

export const RECONNECT_SUCCESS_TOAST_RETRY =
  "Remote signer reconnected. Please retry your action.";

export const TOAST_RECONNECT_SUCCESS = "Remote signer reconnected.";

export const METHOD_BUNKER_INPUT = "bunker_input";

export const EXISTING_SESSION_RECONNECT_TIMEOUTS_MS = [20_000, 40_000] as const;
export const EXISTING_SESSION_RECONNECT_RETRY_DELAY_MS = 1000;

export function debugReconnectTrace(
  message: string,
  details?: Record<string, unknown>
): void {
  if (details) {
    console.info(`[remote-signer-reconnect] ${message}`, details);
    return;
  }
  console.info(`[remote-signer-reconnect] ${message}`);
}
