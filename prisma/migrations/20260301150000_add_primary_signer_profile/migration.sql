-- Add account-level primary NIP-46 signer profile metadata
ALTER TABLE "User"
ADD COLUMN "primarySignerProfile" JSONB;
