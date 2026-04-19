/**
 * Constants and event names for NIP-46 signer connection lifecycle.
 */

export const NIP46_SIGNER_TYPE = "nip46";

export const NOSTR_CONNECTION_STALE_EVENT = "nostr-connection-stale";
export const NOSTR_CONNECTION_HEALTHY_EVENT = "nostr-connection-healthy";

export const VISIBILITY_RECONNECT_THROTTLE_MS = 30_000;
export const RELAY_UNION_CAP = 8;

export const DEFAULT_RELAYS_CONNECT = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
];
