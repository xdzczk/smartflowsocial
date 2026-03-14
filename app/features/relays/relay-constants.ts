/**
 * Canonical relay URL constants for the relays feature.
 * Moved from ~/lib/relays per app/lib audit (domain code in features).
 */

export const relaysArray: string[] = [
  "wss://relay.primal.net",
  "wss://relay.orangepill.dev",
  "wss://nostr.walletofsatoshi.com",
  "wss://lightningrelay.com",
  "wss://at.nostrworks.com",
  "wss://nos.lol",
  "wss://libretechsystems.nostr1.com",
  "wss://btc.klendazu.com",
  "wss://nostr-pub.wellorder.net",
  "wss://nostr.bitcoiner.social",
  "wss://knostr.neutrine.com",
  "wss://nostr-verif.slothy.win",
  "wss://nostr.cercatrova.me",
  "wss://nostr.einundzwanzig.space",
  "wss://nostr.fmt.wiz.biz",
  "wss://nostr.wine",
  "wss://nos.lol/",
  "wss://relay.westernbtc.com",
  "wss://nostr.roundrockbitcoiners.com",
  "wss://nostr.land",
  "wss://nostr.mom",
  "wss://nostrrelay.com",
  "wss://purplepag.es",
  "wss://relay.damus.io",
  "wss://relay.lexingtonbitcoin.org",
  "wss://relay.nquiz.io",
  "wss://relay.snort.social",
  "wss://nostr.semisol.dev",
];

/**
 * Canonical default write relays for a user (relay intent defaults).
 *
 * IMPORTANT:
 * - This is intentionally kept in sync with the Prisma default for `User.userRelays`.
 * - This is NOT the same as `relaysArray` (which is a broader system list).
 */
export const DEFAULT_USER_WRITE_RELAYS: string[] = [
  "wss://relay.bullishbounty.com",
  "wss://relay.snort.social",
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
];

export const blastrRelay = "wss://blastr.smartflow.social";

/**
 * Known system relays that Blastr may fan out to (for policy whitelist/blacklist UI).
 * Used when Blastr does not expose GET /admin/system-relays.
 */
export const BLASTR_KNOWN_SYSTEM_RELAYS: string[] = [
  ...DEFAULT_USER_WRITE_RELAYS,
  "wss://relay.nostr.band",
  "wss://relay.orangepill.dev",
  "wss://nos.lol",
  "wss://nostr.walletofsatoshi.com",
  "wss://relay.lexingtonbitcoin.org",
  "wss://purplepag.es",
];
