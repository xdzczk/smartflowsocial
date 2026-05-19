-- New users publish via NIP-65 profile relays when available (falls back to app defaults in resolver).
ALTER TABLE "User" ALTER COLUMN "publishRelaySource" SET DEFAULT 'nip65_profile';
