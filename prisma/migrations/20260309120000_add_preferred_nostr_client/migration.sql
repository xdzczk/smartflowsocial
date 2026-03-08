-- Add preferred Nostr client for "View note/article" links (PRIMAL, DAMUS, AMETHYST, NOSTUR, NOSTRUDEL, IRIS, YAKIHONNE, CUSTOM)
ALTER TABLE "User" ADD COLUMN "preferredNostrClient" TEXT DEFAULT 'PRIMAL';

-- Base URL when preferredNostrClient is CUSTOM
ALTER TABLE "User" ADD COLUMN "customNostrClientBaseUrl" TEXT;
