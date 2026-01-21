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
  "wss://relay.nostr.band",
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
  "wss://relay.nostr.band",
];

export const blastrRelay = "wss://blastr.smartflowsocial.com";
