/**
 * Constants and event names for NIP-46 signer connection lifecycle.
 */

export const NIP46_SIGNER_TYPE = "nip46";

export const NOSTR_CONNECTION_STALE_EVENT = "nostr-connection-stale";
export const NOSTR_CONNECTION_HEALTHY_EVENT = "nostr-connection-healthy";

export const VERIFY_COOLDOWN_MS = 2 * 60 * 1000;
/** Max age of last ping verification before we re-verify. Ensures we detect a dead channel even when signing frequently. */
export const MAX_VERIFICATION_AGE_MS = 2 * 60 * 1000;
export const CONNECTION_FRESH_MS = 5 * 60 * 1000;
export const RECENT_ACTIVITY_WINDOW_MS = 10 * 60 * 1000;
export const RECONNECT_GRACE_MS = 15 * 60 * 1000;
export const VERIFY_BEFORE_USE_TIMEOUT_MS = 12_000;
export const VISIBILITY_RECONNECT_THROTTLE_MS = 30_000;
export const RELAY_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
export const PROBE_ON_FIRST_USE_TIMEOUT_MS = 4000;
export const PROBE_FAILED_AFTER_RESUME_MESSAGE = "Probe failed after resume";
export const RELAY_UNION_CAP = 8;

export const DEFAULT_RELAYS_CONNECT = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
];
