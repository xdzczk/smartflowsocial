-- Backfill existing users who still have a factory default (or empty) app relay list.
-- Custom relay lists (any other URL set) are left unchanged.

UPDATE "User"
SET "userRelays" = ARRAY[
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nos.lol/',
  'wss://nostr.mom',
  'wss://relay.ditto.pub'
]::TEXT[]
WHERE "userRelays" = '{}'::TEXT[]
   OR "userRelays" = ARRAY[
        'wss://relay.bullishbounty.com',
        'wss://relay.snort.social',
        'wss://relay.primal.net',
        'wss://relay.damus.io',
        'wss://relay.nostr.band'
      ]::TEXT[]
   OR "userRelays" = ARRAY[
        'wss://relay.bullishbounty.com',
        'wss://relay.snort.social',
        'wss://relay.primal.net',
        'wss://relay.damus.io',
        'wss://nos.lol/'
      ]::TEXT[];
