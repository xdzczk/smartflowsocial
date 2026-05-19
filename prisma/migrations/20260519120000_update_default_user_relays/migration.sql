-- Align User.userRelays column default with APP_DEFAULT_RELAYS / DEFAULT_USER_WRITE_RELAYS.
ALTER TABLE "User" ALTER COLUMN "userRelays" SET DEFAULT ARRAY[
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nos.lol/',
  'wss://nostr.mom',
  'wss://relay.ditto.pub'
]::TEXT[];
