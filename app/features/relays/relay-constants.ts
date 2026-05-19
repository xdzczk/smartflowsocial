/**
 * Canonical relay URL constants for the relays feature.
 * Moved from ~/lib/relays per app/lib audit (domain code in features).
 */

/** Default app + system publish relays (per-user list and system fallback). */
export const APP_DEFAULT_RELAYS: string[] = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
  "wss://nostr.mom",
  "wss://relay.ditto.pub",
];

/** System-wide default relay list (publisher fallback, workers, etc.). */
export const relaysArray: string[] = [...APP_DEFAULT_RELAYS];

/**
 * Canonical default write relays for a user (relay intent defaults).
 *
 * IMPORTANT:
 * - Intentionally kept in sync with the Prisma default for `User.userRelays`.
 * - Same URLs as `relaysArray`.
 */
export const DEFAULT_USER_WRITE_RELAYS: string[] = [...APP_DEFAULT_RELAYS];

export const blastrRelay = "wss://blastr.smartflow.social";

/**
 * Known system relays that Blastr may fan out to (for policy whitelist/blacklist UI).
 * Used when Blastr does not expose GET /admin/system-relays.
 */
export const BLASTR_KNOWN_SYSTEM_RELAYS: string[] = [...APP_DEFAULT_RELAYS];
